//! HTTP adapters for /api/v1/telegram (Settings → Telegram).

use std::sync::Arc;

use axum::{extract::State, http::StatusCode, response::IntoResponse};

use super::model::SetBot;
use crate::{
    auth::AuthUser, error::AppError, http::extract::ValidatedJson, http::respond, state::AppState,
};

/// GET /api/v1/telegram
pub async fn status(
    State(state): State<Arc<AppState>>,
    user: AuthUser,
) -> Result<impl IntoResponse, AppError> {
    Ok(respond::ok(
        state.telegram.status(&user.id).await?,
        "telegram",
    ))
}

/// PUT /api/v1/telegram  body: {"botToken": "..."}
pub async fn set_bot(
    State(state): State<Arc<AppState>>,
    user: AuthUser,
    ValidatedJson(body): ValidatedJson<SetBot>,
) -> Result<impl IntoResponse, AppError> {
    Ok(respond::ok(
        state.telegram.set_bot(&user.id, body.bot_token).await?,
        "bot saved",
    ))
}

/// POST /api/v1/telegram/confirm
pub async fn confirm(
    State(state): State<Arc<AppState>>,
    user: AuthUser,
) -> Result<impl IntoResponse, AppError> {
    Ok(respond::ok(
        state.telegram.confirm(&user.id).await?,
        "telegram linked",
    ))
}

/// POST /api/v1/telegram/test
pub async fn test(
    State(state): State<Arc<AppState>>,
    user: AuthUser,
) -> Result<StatusCode, AppError> {
    state.telegram.test(&user.id).await?;
    Ok(StatusCode::NO_CONTENT)
}

/// DELETE /api/v1/telegram
pub async fn disconnect(
    State(state): State<Arc<AppState>>,
    user: AuthUser,
) -> Result<StatusCode, AppError> {
    state.telegram.disconnect(&user.id).await?;
    Ok(StatusCode::NO_CONTENT)
}
