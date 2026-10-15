//! One adapter per wire protocol. Each only maps our types to vendor JSON and back.
//! OpenAI and OpenRouter share the Chat Completions format, so three adapters cover four vendors.

pub mod anthropic;
pub mod gemini;
pub mod openai_compat;

#[cfg(test)]
pub(crate) mod tests_support {
    use serde_json::json;

    use crate::ai::types::{ChatRequest, Message, ToolCall, ToolSpec};

    /// One full tool round-trip: user asks, assistant calls a tool, tool answers.
    pub fn sample_request() -> ChatRequest {
        ChatRequest {
            model: "test-model".into(),
            system: Some("be brief".into()),
            messages: vec![
                Message::User {
                    text: "add milk".into(),
                },
                Message::Assistant {
                    text: None,
                    tool_calls: vec![ToolCall {
                        id: "call_1".into(),
                        name: "create_todo".into(),
                        arguments: json!({ "title": "milk" }),
                    }],
                },
                Message::ToolResult {
                    call_id: "call_1".into(),
                    name: "create_todo".into(),
                    content: "ok".into(),
                },
            ],
            tools: vec![ToolSpec {
                name: "create_todo".into(),
                description: "Create a to-do item".into(),
                parameters: json!({
                    "type": "object",
                    "properties": { "title": { "type": "string" } },
                    "required": ["title"]
                }),
            }],
            max_tokens: 256,
        }
    }
}
