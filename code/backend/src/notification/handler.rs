//! HTTP adapters for /api/v1/notifications. Extract, call the service, respond.
//! The service publishes the live events itself (it is also called by other modules).

use std::sync::Arc;

use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
};
use uuid::Uuid;

use super::model::UpdateNotification;
use crate::{
    auth::AuthUser,
    error::AppError,
    http::extract::{ClientId, ValidatedJson},
    http::respond,
    state::AppState,
};

/// GET /api/v1/notifications
pub async fn list(
    State(state): State<Arc<AppState>>,
    user: AuthUser,
) -> Result<impl IntoResponse, AppError> {
    Ok(respond::ok(
        state.notifications.inbox(&user.id).await?,
        "notifications",
    ))
}

/// PATCH /api/v1/notifications/{id}  body: {"read": true|false}
pub async fn update(
    State(state): State<Arc<AppState>>,
    user: AuthUser,
    origin: ClientId,
    Path(id): Path<Uuid>,
    ValidatedJson(body): ValidatedJson<UpdateNotification>,
) -> Result<impl IntoResponse, AppError> {
    let updated = state
        .notifications
        .set_read(&user.id, id, body.read, origin)
        .await?;
    Ok(respond::ok(updated, "notification updated"))
}

/// POST /api/v1/notifications/read-all
pub async fn read_all(
    State(state): State<Arc<AppState>>,
    user: AuthUser,
    origin: ClientId,
) -> Result<StatusCode, AppError> {
    state.notifications.mark_all_read(&user.id, origin).await?;
    Ok(StatusCode::NO_CONTENT)
}

/// DELETE /api/v1/notifications/{id}
pub async fn remove(
    State(state): State<Arc<AppState>>,
    user: AuthUser,
    origin: ClientId,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, AppError> {
    state.notifications.delete(&user.id, id, origin).await?;
    Ok(StatusCode::NO_CONTENT)
}
