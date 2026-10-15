//! HTTP adapters for /api/v1/vault. Bodies are opaque blobs and are never logged.

use std::sync::Arc;

use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
};
use uuid::Uuid;

use super::model::{CreateItem, UpdateItem, VaultKey};
use crate::{
    auth::AuthUser,
    error::AppError,
    events::{Event, Kind},
    http::extract::{ClientId, ValidatedJson},
    http::respond,
    state::AppState,
};

/// GET /api/v1/vault/key → the wrapped key, or null before set-up
pub async fn get_key(
    State(state): State<Arc<AppState>>,
    user: AuthUser,
) -> Result<impl IntoResponse, AppError> {
    Ok(respond::ok(state.vault.key(&user.id).await?, "vault key"))
}

/// PUT /api/v1/vault/key → set up, change master password, or recover
pub async fn put_key(
    State(state): State<Arc<AppState>>,
    user: AuthUser,
    ValidatedJson(body): ValidatedJson<VaultKey>,
) -> Result<impl IntoResponse, AppError> {
    Ok(respond::ok(
        state.vault.save_key(&user.id, body).await?,
        "vault key saved",
    ))
}

/// DELETE /api/v1/vault → start over (deletes the key and every item)
pub async fn wipe(
    State(state): State<Arc<AppState>>,
    user: AuthUser,
    origin: ClientId,
) -> Result<StatusCode, AppError> {
    state.vault.wipe(&user.id).await?;
    let event = Event::new(&user.id, Kind::VaultDeleted, Uuid::nil(), origin);
    state.events.publish(event);
    Ok(StatusCode::NO_CONTENT)
}

/// GET /api/v1/vault/items
pub async fn list(
    State(state): State<Arc<AppState>>,
    user: AuthUser,
) -> Result<impl IntoResponse, AppError> {
    Ok(respond::ok(
        state.vault.items(&user.id).await?,
        "vault items",
    ))
}

/// POST /api/v1/vault/items
pub async fn create(
    State(state): State<Arc<AppState>>,
    user: AuthUser,
    origin: ClientId,
    ValidatedJson(body): ValidatedJson<CreateItem>,
) -> Result<impl IntoResponse, AppError> {
    let created = state.vault.create_item(&user.id, body).await?;
    let event = Event::new(&user.id, Kind::VaultCreated, created.id, origin);
    state.events.publish(event);
    Ok(respond::created(created, "vault item created"))
}

/// PUT /api/v1/vault/items/{id}
pub async fn update(
    State(state): State<Arc<AppState>>,
    user: AuthUser,
    origin: ClientId,
    Path(id): Path<Uuid>,
    ValidatedJson(body): ValidatedJson<UpdateItem>,
) -> Result<impl IntoResponse, AppError> {
    let updated = state.vault.update_item(&user.id, id, body).await?;
    let event = Event::new(&user.id, Kind::VaultUpdated, id, origin);
    state.events.publish(event);
    Ok(respond::ok(updated, "vault item updated"))
}

/// DELETE /api/v1/vault/items/{id}
pub async fn remove(
    State(state): State<Arc<AppState>>,
    user: AuthUser,
    origin: ClientId,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, AppError> {
    state.vault.delete_item(&user.id, id).await?;
    let event = Event::new(&user.id, Kind::VaultDeleted, id, origin);
    state.events.publish(event);
    Ok(StatusCode::NO_CONTENT)
}
