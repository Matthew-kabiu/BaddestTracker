//! OpenAI Chat Completions format — used by OpenAI and OpenRouter.

use async_trait::async_trait;
use secrecy::{ExposeSecret, SecretString};
use serde_json::{Value, json};

use crate::ai::provider::{LlmProvider, ProviderKind, bad_shape, send_json};
use crate::ai::types::{ChatRequest, ChatResponse, Message, ToolCall, Usage};
use crate::error::AppError;

pub struct OpenAiCompat {
    http: reqwest::Client,
    api_key: SecretString,
    kind: ProviderKind,
}

impl OpenAiCompat {
    pub fn new(http: reqwest::Client, api_key: SecretString, kind: ProviderKind) -> Self {
        Self {
            http,
            api_key,
            kind,
        }
    }

    fn url(&self) -> &'static str {
        match self.kind {
            ProviderKind::OpenRouter => "https://openrouter.ai/api/v1/chat/completions",
            _ => "https://api.openai.com/v1/chat/completions",
        }
    }
}

#[async_trait]
impl LlmProvider for OpenAiCompat {
    async fn chat(&self, req: &ChatRequest) -> Result<ChatResponse, AppError> {
        let mut builder = self
            .http
            .post(self.url())
            .bearer_auth(self.api_key.expose_secret())
            .json(&build_body(req, self.kind));
        if self.kind == ProviderKind::OpenRouter {
            builder = builder.header("X-OpenRouter-Title", "Baddest Tracker");
        }
        let body = send_json(builder, self.kind).await?;
        parse_response(&body, self.kind)
    }
}

pub(crate) fn build_body(req: &ChatRequest, kind: ProviderKind) -> Value {
    let mut messages = Vec::new();
    if let Some(system) = &req.system {
        messages.push(json!({ "role": "system", "content": system }));
    }
    for m in &req.messages {
        messages.push(match m {
            Message::User { text } => json!({ "role": "user", "content": text }),
            Message::Assistant { text, tool_calls } => {
                let mut msg = json!({ "role": "assistant", "content": text });
                if !tool_calls.is_empty() {
                    msg["tool_calls"] = tool_calls
                        .iter()
                        .map(|c| {
                            json!({
                                "id": c.id,
                                "type": "function",
                                // The API expects arguments as a JSON-encoded string.
                                "function": { "name": c.name, "arguments": c.arguments.to_string() },
                            })
                        })
                        .collect();
                }
                msg
            }
            Message::ToolResult { call_id, content, .. } => {
                json!({ "role": "tool", "tool_call_id": call_id, "content": content })
            }
        });
    }

    let mut body = json!({ "model": req.model, "messages": messages });
    // OpenAI's current name is max_completion_tokens; OpenRouter documents max_tokens.
    let limit_key = match kind {
        ProviderKind::OpenRouter => "max_tokens",
        _ => "max_completion_tokens",
    };
    body[limit_key] = json!(req.max_tokens);
    if !req.tools.is_empty() {
        body["tools"] = req
            .tools
            .iter()
            .map(|t| {
                json!({
                    "type": "function",
                    "function": { "name": t.name, "description": t.description, "parameters": t.parameters },
                })
            })
            .collect();
    }
    body
}

pub(crate) fn parse_response(body: &Value, kind: ProviderKind) -> Result<ChatResponse, AppError> {
    let message = body
        .pointer("/choices/0/message")
        .ok_or_else(|| bad_shape(kind, "missing choices[0].message"))?;

    let text = message
        .get("content")
        .and_then(Value::as_str)
        .filter(|s| !s.is_empty())
        .map(str::to_owned);

    let tool_calls = message
        .get("tool_calls")
        .and_then(Value::as_array)
        .map(|calls| {
            calls
                .iter()
                .filter_map(|c| {
                    let id = c.get("id")?.as_str()?.to_owned();
                    let name = c.pointer("/function/name")?.as_str()?.to_owned();
                    let raw = c.pointer("/function/arguments")?.as_str().unwrap_or("{}");
                    // Malformed arguments are passed through as a string; the tool rejects them.
                    let arguments =
                        serde_json::from_str(raw).unwrap_or_else(|_| Value::String(raw.to_owned()));
                    Some(ToolCall {
                        id,
                        name,
                        arguments,
                    })
                })
                .collect()
        })
        .unwrap_or_default();

    let usage = Usage {
        input_tokens: body
            .pointer("/usage/prompt_tokens")
            .and_then(Value::as_u64)
            .unwrap_or(0),
        output_tokens: body
            .pointer("/usage/completion_tokens")
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
    fn builds_openai_body_with_tools_and_tool_turns() {
        let body = build_body(&sample_request(), ProviderKind::OpenAi);
        assert_eq!(body["model"], "test-model");
        assert_eq!(body["max_completion_tokens"], 256);
        assert!(body.get("max_tokens").is_none());
        let msgs = body["messages"].as_array().unwrap();
        assert_eq!(msgs[0]["role"], "system");
        assert_eq!(msgs[1], json!({"role": "user", "content": "add milk"}));
        assert_eq!(msgs[2]["tool_calls"][0]["function"]["name"], "create_todo");
        assert_eq!(
            msgs[2]["tool_calls"][0]["function"]["arguments"],
            r#"{"title":"milk"}"#
        );
        assert_eq!(
            msgs[3],
            json!({"role": "tool", "tool_call_id": "call_1", "content": "ok"})
        );
        assert_eq!(body["tools"][0]["type"], "function");
        assert_eq!(body["tools"][0]["function"]["parameters"]["type"], "object");
    }

    #[test]
    fn openrouter_uses_max_tokens() {
        let body = build_body(&sample_request(), ProviderKind::OpenRouter);
        assert_eq!(body["max_tokens"], 256);
        assert!(body.get("max_completion_tokens").is_none());
    }

    #[test]
    fn parses_text_and_tool_calls() {
        let fixture = json!({
            "choices": [{ "message": {
                "role": "assistant",
                "content": null,
                "tool_calls": [{ "id": "call_9", "type": "function",
                    "function": { "name": "list_todos", "arguments": "{\"done\":false}" } }]
            }}],
            "usage": { "prompt_tokens": 12, "completion_tokens": 5, "total_tokens": 17 }
        });
        let r = parse_response(&fixture, ProviderKind::OpenAi).unwrap();
        assert_eq!(r.text, None);
        assert_eq!(r.tool_calls[0].id, "call_9");
        assert_eq!(r.tool_calls[0].arguments, json!({"done": false}));
        assert_eq!(
            r.usage,
            Usage {
                input_tokens: 12,
                output_tokens: 5
            }
        );

        let text_only = json!({ "choices": [{ "message": { "content": "Done." } }] });
        let r = parse_response(&text_only, ProviderKind::OpenRouter).unwrap();
        assert_eq!(r.text.as_deref(), Some("Done."));
        assert!(r.tool_calls.is_empty());
    }

    #[test]
    fn rejects_missing_choices() {
        assert!(parse_response(&json!({}), ProviderKind::OpenAi).is_err());
    }
}
