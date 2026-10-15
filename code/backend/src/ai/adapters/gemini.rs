//! Google Gemini generateContent (v1beta).

use async_trait::async_trait;
use secrecy::{ExposeSecret, SecretString};
use serde_json::{Value, json};

use crate::ai::provider::{LlmProvider, ProviderKind, bad_shape, send_json};
use crate::ai::types::{ChatRequest, ChatResponse, Message, ToolCall, Usage};
use crate::error::AppError;

const BASE: &str = "https://generativelanguage.googleapis.com/v1beta/models";

pub struct Gemini {
    http: reqwest::Client,
    api_key: SecretString,
}

impl Gemini {
    pub fn new(http: reqwest::Client, api_key: SecretString) -> Self {
        Self { http, api_key }
    }
}

#[async_trait]
impl LlmProvider for Gemini {
    async fn chat(&self, req: &ChatRequest) -> Result<ChatResponse, AppError> {
        // The model ID is validated (ProviderKind::is_valid_model) before it reaches the URL.
        let url = format!("{BASE}/{}:generateContent", req.model);
        // Key in a header, never in the query string, so it can't end up in URL logs.
        let builder = self
            .http
            .post(url)
            .header("x-goog-api-key", self.api_key.expose_secret())
            .json(&build_body(req));
        let body = send_json(builder, ProviderKind::Gemini).await?;
        parse_response(&body)
    }
}

pub(crate) fn build_body(req: &ChatRequest) -> Value {
    let mut contents: Vec<Value> = Vec::new();
    for m in &req.messages {
        match m {
            Message::User { text } => {
                contents.push(json!({ "role": "user", "parts": [{ "text": text }] }))
            }
            Message::Assistant { text, tool_calls } => {
                let mut parts = Vec::new();
                if let Some(t) = text {
                    parts.push(json!({ "text": t }));
                }
                for c in tool_calls {
                    parts.push(json!({ "functionCall": { "name": c.name, "args": c.arguments } }));
                }
                contents.push(json!({ "role": "model", "parts": parts }));
            }
            Message::ToolResult { name, content, .. } => {
                let part = json!({ "functionResponse": { "name": name, "response": { "content": content } } });
                // Results for one model turn go back together in a single user turn.
                match contents.last_mut() {
                    Some(last) if is_function_response_turn(last) => {
                        if let Some(arr) = last["parts"].as_array_mut() {
                            arr.push(part);
                        }
                    }
                    _ => contents.push(json!({ "role": "user", "parts": [part] })),
                }
            }
        }
    }

    let mut body = json!({
        "contents": contents,
        "generationConfig": { "maxOutputTokens": req.max_tokens },
    });
    if let Some(system) = &req.system {
        body["systemInstruction"] = json!({ "parts": [{ "text": system }] });
    }
    if !req.tools.is_empty() {
        let decls: Vec<Value> = req
            .tools
            .iter()
            .map(|t| json!({ "name": t.name, "description": t.description, "parameters": t.parameters }))
            .collect();
        body["tools"] = json!([{ "functionDeclarations": decls }]);
    }
    body
}

fn is_function_response_turn(c: &Value) -> bool {
    c["role"] == "user"
        && c["parts"]
            .as_array()
            .is_some_and(|p| p.iter().all(|x| x.get("functionResponse").is_some()))
}

pub(crate) fn parse_response(body: &Value) -> Result<ChatResponse, AppError> {
    let parts = body
        .pointer("/candidates/0/content/parts")
        .and_then(Value::as_array)
        .ok_or_else(|| bad_shape(ProviderKind::Gemini, "missing candidates[0].content.parts"))?;

    let mut texts = Vec::new();
    let mut tool_calls = Vec::new();
    for (i, p) in parts.iter().enumerate() {
        if let Some(t) = p.get("text").and_then(Value::as_str) {
            texts.push(t.to_owned());
        }
        if let Some(fc) = p.get("functionCall")
            && let Some(name) = fc.get("name").and_then(Value::as_str)
        {
            // Gemini call IDs are optional; synthesise a stable one when absent.
            let id = fc
                .get("id")
                .and_then(Value::as_str)
                .map(str::to_owned)
                .unwrap_or_else(|| format!("{name}-{i}"));
            tool_calls.push(ToolCall {
                id,
                name: name.to_owned(),
                arguments: fc.get("args").cloned().unwrap_or_else(|| json!({})),
            });
        }
    }

    let text = if texts.is_empty() {
        None
    } else {
        Some(texts.join("\n"))
    };
    let usage = Usage {
        input_tokens: body
            .pointer("/usageMetadata/promptTokenCount")
            .and_then(Value::as_u64)
            .unwrap_or(0),
        output_tokens: body
            .pointer("/usageMetadata/candidatesTokenCount")
            .and_then(Value::as_u64)
            .unwrap_or(0),
    };
    Ok(ChatResponse {
        text,
        tool_calls,
        usage,
    })
}

#[cfg(test)]
#[allow(clippy::unwrap_used)] // tests may unwrap: a panic is a test failure
mod tests {
    use super::*;
    use crate::ai::adapters::tests_support::sample_request;

    #[test]
    fn builds_body_with_roles_tools_and_function_response() {
        let body = build_body(&sample_request());
        assert_eq!(body["systemInstruction"]["parts"][0]["text"], "be brief");
        assert_eq!(body["generationConfig"]["maxOutputTokens"], 256);
        let c = body["contents"].as_array().unwrap();
        assert_eq!(c[0]["role"], "user");
        assert_eq!(c[1]["role"], "model");
        assert_eq!(
            c[1]["parts"][0]["functionCall"]["args"],
            json!({"title": "milk"})
        );
        assert_eq!(c[2]["role"], "user");
        assert_eq!(c[2]["parts"][0]["functionResponse"]["name"], "create_todo");
        assert_eq!(
            body["tools"][0]["functionDeclarations"][0]["name"],
            "create_todo"
        );
    }

    #[test]
    fn parses_text_and_function_call() {
        let fixture = json!({
            "candidates": [{ "content": { "role": "model", "parts": [
                { "text": "On it." },
                { "functionCall": { "name": "create_todo", "args": { "title": "milk" } } }
            ]}}],
            "usageMetadata": { "promptTokenCount": 30, "candidatesTokenCount": 9, "totalTokenCount": 39 }
        });
        let r = parse_response(&fixture).unwrap();
        assert_eq!(r.text.as_deref(), Some("On it."));
        assert_eq!(r.tool_calls[0].name, "create_todo");
        assert_eq!(r.tool_calls[0].id, "create_todo-1");
        assert_eq!(
            r.usage,
            Usage {
                input_tokens: 30,
                output_tokens: 9
            }
        );
    }

    #[test]
    fn rejects_missing_candidates() {
        assert!(parse_response(&json!({"promptFeedback": {}})).is_err());
    }
}
