//! Anthropic Messages API (POST /v1/messages).

use async_trait::async_trait;
use secrecy::{ExposeSecret, SecretString};
use serde_json::{Value, json};

use crate::ai::provider::{LlmProvider, ProviderKind, bad_shape, send_json};
use crate::ai::types::{ChatRequest, ChatResponse, Message, ToolCall, Usage};
use crate::error::AppError;

const URL: &str = "https://api.anthropic.com/v1/messages";
const API_VERSION: &str = "2023-06-01";

pub struct Anthropic {
    http: reqwest::Client,
    api_key: SecretString,
}

impl Anthropic {
    pub fn new(http: reqwest::Client, api_key: SecretString) -> Self {
        Self { http, api_key }
    }
}

#[async_trait]
impl LlmProvider for Anthropic {
    async fn chat(&self, req: &ChatRequest) -> Result<ChatResponse, AppError> {
        let builder = self
            .http
            .post(URL)
            .header("x-api-key", self.api_key.expose_secret())
            .header("anthropic-version", API_VERSION)
            .json(&build_body(req));
        let body = send_json(builder, ProviderKind::Anthropic).await?;
        parse_response(&body)
    }
}

pub(crate) fn build_body(req: &ChatRequest) -> Value {
    let mut messages: Vec<Value> = Vec::new();
    for m in &req.messages {
        match m {
            Message::User { text } => messages.push(json!({ "role": "user", "content": text })),
            Message::Assistant { text, tool_calls } => {
                let mut content = Vec::new();
                if let Some(t) = text {
                    content.push(json!({ "type": "text", "text": t }));
                }
                for c in tool_calls {
                    content.push(json!({ "type": "tool_use", "id": c.id, "name": c.name, "input": c.arguments }));
                }
                messages.push(json!({ "role": "assistant", "content": content }));
            }
            Message::ToolResult {
                call_id, content, ..
            } => {
                let block =
                    json!({ "type": "tool_result", "tool_use_id": call_id, "content": content });
                // Results for one assistant turn go back together in a single user message.
                match messages.last_mut() {
                    Some(last) if is_tool_result_message(last) => {
                        if let Some(arr) = last["content"].as_array_mut() {
                            arr.push(block);
                        }
                    }
                    _ => messages.push(json!({ "role": "user", "content": [block] })),
                }
            }
        }
    }

    let mut body =
        json!({ "model": req.model, "max_tokens": req.max_tokens, "messages": messages });
    if let Some(system) = &req.system {
        body["system"] = json!(system);
    }
    if !req.tools.is_empty() {
        body["tools"] = req
            .tools
            .iter()
            .map(|t| json!({ "name": t.name, "description": t.description, "input_schema": t.parameters }))
            .collect();
    }
    body
}

fn is_tool_result_message(m: &Value) -> bool {
    m["role"] == "user"
        && m["content"]
            .as_array()
            .is_some_and(|a| a.iter().all(|b| b["type"] == "tool_result"))
}

pub(crate) fn parse_response(body: &Value) -> Result<ChatResponse, AppError> {
    let blocks = body
        .get("content")
        .and_then(Value::as_array)
        .ok_or_else(|| bad_shape(ProviderKind::Anthropic, "missing content[]"))?;

    let mut texts = Vec::new();
    let mut tool_calls = Vec::new();
    for b in blocks {
        match b.get("type").and_then(Value::as_str) {
            Some("text") => {
                if let Some(t) = b.get("text").and_then(Value::as_str) {
                    texts.push(t.to_owned());
                }
            }
            Some("tool_use") => {
                if let (Some(id), Some(name)) = (b["id"].as_str(), b["name"].as_str()) {
                    tool_calls.push(ToolCall {
                        id: id.to_owned(),
                        name: name.to_owned(),
                        arguments: b.get("input").cloned().unwrap_or_else(|| json!({})),
                    });
                }
            }
            _ => {} // thinking and other block types are not surfaced
        }
    }

    let text = if texts.is_empty() {
        None
    } else {
        Some(texts.join("\n"))
    };
    let usage = Usage {
        input_tokens: body
            .pointer("/usage/input_tokens")
            .and_then(Value::as_u64)
            .unwrap_or(0),
        output_tokens: body
            .pointer("/usage/output_tokens")
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
    fn builds_body_with_system_tools_and_grouped_results() {
        let mut req = sample_request();
        // Two results for one turn must land in ONE user message.
        req.messages.push(Message::ToolResult {
            call_id: "call_2".into(),
            name: "create_todo".into(),
            content: "ok2".into(),
        });
        let body = build_body(&req);
        assert_eq!(body["system"], "be brief");
        assert_eq!(body["max_tokens"], 256);
        let msgs = body["messages"].as_array().unwrap();
        assert_eq!(msgs.len(), 3);
        assert_eq!(msgs[1]["content"][0]["type"], "tool_use");
        assert_eq!(msgs[1]["content"][0]["input"], json!({"title": "milk"}));
        assert_eq!(msgs[2]["role"], "user");
        assert_eq!(msgs[2]["content"].as_array().unwrap().len(), 2);
        assert_eq!(msgs[2]["content"][0]["tool_use_id"], "call_1");
        assert_eq!(body["tools"][0]["input_schema"]["type"], "object");
    }

    #[test]
    fn parses_text_and_tool_use() {
        let fixture = json!({
            "id": "msg_1", "type": "message", "role": "assistant",
            "content": [
                { "type": "text", "text": "Adding it." },
                { "type": "tool_use", "id": "toolu_1", "name": "create_todo", "input": { "title": "milk" } }
            ],
            "stop_reason": "tool_use",
            "usage": { "input_tokens": 20, "output_tokens": 8 }
        });
        let r = parse_response(&fixture).unwrap();
        assert_eq!(r.text.as_deref(), Some("Adding it."));
        assert_eq!(r.tool_calls[0].id, "toolu_1");
        assert_eq!(r.tool_calls[0].arguments, json!({"title": "milk"}));
        assert_eq!(
            r.usage,
            Usage {
                input_tokens: 20,
                output_tokens: 8
            }
        );
    }

    #[test]
    fn rejects_missing_content() {
        assert!(parse_response(&json!({"type": "error"})).is_err());
    }
}
