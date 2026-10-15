//! AI business logic: manage a user's BYOK keys and run the bounded tool-calling loop.

use std::sync::Arc;

use chrono::{DateTime, FixedOffset};
use secrecy::SecretString;
use serde::Serialize;

use super::provider::ProviderKind;
use super::registry;
use super::repository::{NewKey, Repository};
use super::tools::{self, ToolContext};
use super::types::{ChatRequest, Message, Usage};
use crate::crypto::{self, KeyCipher, Sealed};
use crate::{auth::AuthUser, error::AppError, state::AppState};

/// Model round-trips allowed per chat request. Exceeding it is a clean error, never a hang.
/// (The decision record puts this in Config; it's a constant until a second value is needed.)
const MAX_TOOL_ROUNDS: usize = 5;
const MAX_OUTPUT_TOKENS: u32 = 2048;

const SYSTEM_PROMPT: &str = "You are the assistant inside Baddest Tracker, a personal app for \
shopping lists, budgets, calendar, reminders, to-dos and notes. You can only read or change the \
user's data through the tools you are given; if no tool fits, say so plainly. You have no access \
to the user's password vault and must never ask for passwords or API keys.";

/// What the client sees about a stored key — never the key itself.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct KeySummary {
    pub provider: ProviderKind,
    pub model: String,
    pub updated_at: DateTime<FixedOffset>,
}

#[derive(Debug, Serialize)]
pub struct ChatOutcome {
    pub reply: String,
    pub usage: Usage,
    pub rounds: usize,
}

pub struct Service {
    state: Arc<AppState>,
    repo: Repository,
}

impl Service {
    pub fn new(state: Arc<AppState>) -> Self {
        let repo = Repository::new(state.db.clone());
        Self { state, repo }
    }

    fn cipher(&self) -> Result<KeyCipher, AppError> {
        KeyCipher::from_base64(&self.state.config.ai_keys_encryption_key)
    }

    pub async fn set_key(
        &self,
        user: &AuthUser,
        kind: ProviderKind,
        api_key: SecretString,
        model: &str,
    ) -> Result<KeySummary, AppError> {
        if !kind.is_valid_model(model) {
            return Err(AppError::Validation(
                "model name contains unsupported characters".into(),
            ));
        }
        let sealed = self
            .cipher()?
            .seal(&api_key, &crypto::aad(&user.id, kind.as_str()))?;
        let saved = self
            .repo
            .upsert(NewKey {
                user_id: &user.id,
                provider: kind.as_str(),
                model,
                ciphertext: sealed.ciphertext,
                nonce: sealed.nonce,
            })
            .await?;
        Ok(KeySummary {
            provider: kind,
            model: saved.model,
            updated_at: saved.updated_at,
        })
    }

    pub async fn list_keys(&self, user: &AuthUser) -> Result<Vec<KeySummary>, AppError> {
        let rows = self.repo.list(&user.id).await?;
        Ok(rows
            .into_iter()
            // A row with an unknown provider string (e.g. one removed later) is skipped, not fatal.
            .filter_map(|r| {
                ProviderKind::parse(&r.provider).map(|provider| KeySummary {
                    provider,
                    model: r.model,
                    updated_at: r.updated_at,
                })
            })
            .collect())
    }

    pub async fn delete_key(&self, user: &AuthUser, kind: ProviderKind) -> Result<(), AppError> {
        if self.repo.delete(&user.id, kind.as_str()).await? {
            Ok(())
        } else {
            Err(AppError::NotFound("provider key"))
        }
    }

    /// Send the conversation to the user's chosen provider, executing tool calls until the
    /// model answers in plain text or `MAX_TOOL_ROUNDS` is reached.
    pub async fn chat(
        &self,
        user: &AuthUser,
        kind: ProviderKind,
        mut messages: Vec<Message>,
    ) -> Result<ChatOutcome, AppError> {
        let row = self
            .repo
            .find(&user.id, kind.as_str())
            .await?
            .ok_or_else(|| {
                AppError::Validation(format!("no API key saved for {}", kind.as_str()))
            })?;
        let api_key = self.cipher()?.open(
            &Sealed {
                ciphertext: row.ciphertext,
                nonce: row.nonce,
            },
            &crypto::aad(&user.id, kind.as_str()),
        )?;
        let provider = registry::build(kind, api_key, self.state.http.clone());

        let tools = tools::all();
        let ctx = ToolContext {
            state: &self.state,
            user,
        };
        let mut usage = Usage::default();

        for round in 1..=MAX_TOOL_ROUNDS {
            let req = ChatRequest {
                model: row.model.clone(),
                system: Some(SYSTEM_PROMPT.to_owned()),
                messages: messages.clone(),
                tools: tools.iter().map(|t| t.spec()).collect(),
                max_tokens: MAX_OUTPUT_TOKENS,
            };
            let resp = provider.chat(&req).await?;
            usage.add(resp.usage);

            if resp.tool_calls.is_empty() {
                return Ok(ChatOutcome {
                    reply: resp.text.unwrap_or_default(),
                    usage,
                    rounds: round,
                });
            }

            messages.push(Message::Assistant {
                text: resp.text,
                tool_calls: resp.tool_calls.clone(),
            });
            for call in resp.tool_calls {
                let content = match tools.iter().find(|t| t.spec().name == call.name) {
                    None => format!("error: unknown tool '{}'", call.name),
                    Some(tool) => match tool.call(&ctx, call.arguments).await {
                        Ok(v) => v.to_string(),
                        // Client-safe errors go back to the model so it can correct itself;
                        // internal causes are logged and replaced with a generic message.
                        Err(AppError::Internal(e)) => {
                            tracing::error!(error = ?e, tool = %call.name, "tool failed");
                            "error: the tool failed".to_owned()
                        }
                        Err(e) => format!("error: {e}"),
                    },
                };
                messages.push(Message::ToolResult {
                    call_id: call.id,
                    name: call.name,
                    content,
                });
            }
        }

        Err(AppError::Validation(
            "the assistant needed too many steps; try a simpler request".into(),
        ))
    }
}
