//! HTTP adapters for /api/v1/ai. Extract + validate, call the service, respond. No logic.

use std::sync::Arc;

use axum::{
    Json,
    extract::{
        Path, State,
        rejection::{JsonRejection, PathRejection},
    },
    http::StatusCode,
    response::IntoResponse,
};
use secrecy::SecretString;
use serde::{Deserialize, Serialize};
use validator::Validate;

use super::provider::ProviderKind;
use super::service::Service;
use super::types::Message;
use crate::{auth::AuthUser, error::AppError, http::respond, state::AppState};

// No Debug derive: the body carries the plaintext API key.
#[derive(Deserialize, Validate)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
pub struct PutKeyRequest {
    #[validate(length(min = 8, max = 512))]
    api_key: String,
    #[validate(length(min = 1, max = 200))]
    model: String,
}

#[derive(Deserialize, Validate)]
#[serde(deny_unknown_fields)]
pub struct ChatBody {
    provider: ProviderKind,
    #[validate(length(min = 1, max = 50), nested)]
    messages: Vec<ChatMessage>,
}

// validator 0.21 requires Serialize on types validated with `nested`.
#[derive(Deserialize, Serialize, Validate)]
#[serde(deny_unknown_fields)]
pub struct ChatMessage {
    role: ChatRole,
    #[validate(length(min = 1, max = 20000))]
    content: String,
}

/// Clients send plain conversation history only; tool turns are internal to one request.
#[derive(Deserialize, Serialize, Clone, Copy)]
#[serde(rename_all = "lowercase")]
enum ChatRole {
    User,
    Assistant,
}

fn body<T: Validate>(payload: Result<Json<T>, JsonRejection>) -> Result<T, AppError> {
    let Json(value) = payload.map_err(|_| AppError::Validation("malformed request body".into()))?;
    value
        .validate()
        .map_err(|e| AppError::Validation(format!("invalid request: {e}")))?;
    Ok(value)
}

fn provider(path: Result<Path<String>, PathRejection>) -> Result<ProviderKind, AppError> {
    let Path(raw) = path.map_err(|_| AppError::Validation("missing provider".into()))?;
    ProviderKind::parse(&raw).ok_or_else(|| {
        AppError::Validation(
            "provider must be one of: anthropic, openai, openrouter, gemini".into(),
        )
    })
}

/// GET /api/v1/ai/keys — which providers the user has configured (never the keys).
pub async fn list_keys(
    State(state): State<Arc<AppState>>,
    user: AuthUser,
) -> Result<impl IntoResponse, AppError> {
    let keys = Service::new(state).list_keys(&user).await?;
    Ok(respond::ok(keys, "provider keys"))
}

/// PUT /api/v1/ai/keys/{provider} — save or replace the user's key and default model.
pub async fn put_key(
    State(state): State<Arc<AppState>>,
    user: AuthUser,
    path: Result<Path<String>, PathRejection>,
    payload: Result<Json<PutKeyRequest>, JsonRejection>,
) -> Result<impl IntoResponse, AppError> {
    let kind = provider(path)?;
    let req = body(payload)?;
    let summary = Service::new(state)
        .set_key(&user, kind, SecretString::from(req.api_key), &req.model)
        .await?;
    Ok(respond::ok(summary, "provider key saved"))
}

/// DELETE /api/v1/ai/keys/{provider}
pub async fn delete_key(
    State(state): State<Arc<AppState>>,
    user: AuthUser,
    path: Result<Path<String>, PathRejection>,
) -> Result<impl IntoResponse, AppError> {
    let kind = provider(path)?;
    Service::new(state).delete_key(&user, kind).await?;
    Ok(StatusCode::NO_CONTENT)
}

/// POST /api/v1/ai/chat — one assistant reply for the given conversation.
pub async fn chat(
    State(state): State<Arc<AppState>>,
    user: AuthUser,
    payload: Result<Json<ChatBody>, JsonRejection>,
) -> Result<impl IntoResponse, AppError> {
    let req = body(payload)?;
    let messages = req
        .messages
        .into_iter()
        .map(|m| match m.role {
            ChatRole::User => Message::User { text: m.content },
            ChatRole::Assistant => Message::Assistant {
                text: Some(m.content),
                tool_calls: Vec::new(),
            },
        })
        .collect();
    let outcome = Service::new(state)
        .chat(&user, req.provider, messages)
        .await?;
    Ok(respond::ok(outcome, "assistant reply"))
}
