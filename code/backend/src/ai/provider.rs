//! The one trait every model vendor implements, plus the shared HTTP send helper.

use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use serde_json::Value;

use super::types::{ChatRequest, ChatResponse};
use crate::error::AppError;

#[async_trait]
pub trait LlmProvider: Send + Sync {
    async fn chat(&self, req: &ChatRequest) -> Result<ChatResponse, AppError>;
}

/// Which vendor a user's key belongs to. Serialized as the path/DB value shown in `as_str`.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum ProviderKind {
    #[serde(rename = "anthropic")]
    Anthropic,
    #[serde(rename = "openai")]
    OpenAi,
    #[serde(rename = "openrouter")]
    OpenRouter,
    #[serde(rename = "gemini")]
    Gemini,
}

impl ProviderKind {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Anthropic => "anthropic",
            Self::OpenAi => "openai",
            Self::OpenRouter => "openrouter",
            Self::Gemini => "gemini",
        }
    }

    pub fn parse(s: &str) -> Option<Self> {
        match s {
            "anthropic" => Some(Self::Anthropic),
            "openai" => Some(Self::OpenAi),
            "openrouter" => Some(Self::OpenRouter),
            "gemini" => Some(Self::Gemini),
            _ => None,
        }
    }

    /// Model IDs go into URLs (Gemini) and request bodies; only allow plain identifier characters.
    /// OpenRouter IDs look like `vendor/model:variant`, so `/` and `:` are allowed there only.
    pub fn is_valid_model(self, model: &str) -> bool {
        let extra: &[char] = match self {
            Self::OpenRouter => &['/', ':'],
            _ => &[],
        };
        !model.is_empty()
            && model.len() <= 200
            && model.chars().all(|c| {
                c.is_ascii_alphanumeric() || matches!(c, '-' | '.' | '_') || extra.contains(&c)
            })
    }
}

/// Send a JSON request to a vendor and return the JSON body.
/// Vendor error bodies are never forwarded: only the status reaches the client, and only the
/// status (never the body, which can echo the key or prompt) is logged.
pub(crate) async fn send_json(
    builder: reqwest::RequestBuilder,
    provider: ProviderKind,
) -> Result<Value, AppError> {
    let resp = builder.send().await.map_err(|e| {
        AppError::Internal(
            anyhow::Error::new(e).context(format!("{} request failed", provider.as_str())),
        )
    })?;
    let status = resp.status();
    if !status.is_success() {
        tracing::warn!(provider = provider.as_str(), %status, "provider rejected request");
        let hint = match status.as_u16() {
            401 | 403 => " (check your API key)",
            404 => " (check the model name)",
            429 => " (rate limited or out of credit)",
            _ => "",
        };
        return Err(AppError::Validation(format!(
            "provider rejected the request: {status}{hint}"
        )));
    }
    resp.json::<Value>().await.map_err(|e| {
        AppError::Internal(
            anyhow::Error::new(e).context(format!("decode {} response", provider.as_str())),
        )
    })
}

/// Turn a malformed-but-200 vendor body into an internal error with context.
pub(crate) fn bad_shape(provider: ProviderKind, what: &str) -> AppError {
    AppError::Internal(anyhow::anyhow!(
        "unexpected {} response shape: {what}",
        provider.as_str()
    ))
}
