//! Builds the right adapter for a user's stored key. Constructed per request — adapters are
//! cheap (the reqwest client is a shared handle).

use secrecy::SecretString;

use super::adapters::{anthropic::Anthropic, gemini::Gemini, openai_compat::OpenAiCompat};
use super::provider::{LlmProvider, ProviderKind};

pub fn build(
    kind: ProviderKind,
    api_key: SecretString,
    http: reqwest::Client,
) -> Box<dyn LlmProvider> {
    match kind {
        ProviderKind::Anthropic => Box::new(Anthropic::new(http, api_key)),
        ProviderKind::OpenAi | ProviderKind::OpenRouter => {
            Box::new(OpenAiCompat::new(http, api_key, kind))
        }
        ProviderKind::Gemini => Box::new(Gemini::new(http, api_key)),
    }
}
