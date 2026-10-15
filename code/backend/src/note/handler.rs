//! HTTP adapters for /api/v1/notes. Extract, call the service, publish the live event, respond.

use std::sync::Arc;

use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
};
use uuid::Uuid;

use super::model::{CreateNote, UpdateNote};
use crate::{
    auth::AuthUser,
    error::AppError,
    events::{Event, Kind},
    http::extract::{ClientId, ValidatedJson},
    http::respond,
    state::AppState,
};

/// GET /api/v1/notes
pub async fn list(
    State(state): State<Arc<AppState>>,
    user: AuthUser,
) -> Result<impl IntoResponse, AppError> {
    Ok(respond::ok(state.notes.list(&user.id).await?, "notes"))
}

/// POST /api/v1/notes
pub async fn create(
    State(state): State<Arc<AppState>>,
    user: AuthUser,
    origin: ClientId,
    ValidatedJson(body): ValidatedJson<CreateNote>,
) -> Result<impl IntoResponse, AppError> {
    let created = state.notes.create(&user.id, body).await?;
    let event = Event::new(&user.id, Kind::NoteCreated, created.id, origin);
    state.events.publish(event);
    Ok(respond::created(created, "note created"))
}

/// PATCH /api/v1/notes/{id}
pub async fn update(
    State(state): State<Arc<AppState>>,
    user: AuthUser,
    origin: ClientId,
    Path(id): Path<Uuid>,
    ValidatedJson(body): ValidatedJson<UpdateNote>,
) -> Result<impl IntoResponse, AppError> {
    let updated = state.notes.update(&user.id, id, body).await?;
    let event = Event::new(&user.id, Kind::NoteUpdated, id, origin);
    state.events.publish(event);
    Ok(respond::ok(updated, "note updated"))
}

/// DELETE /api/v1/notes/{id}
pub async fn remove(
    State(state): State<Arc<AppState>>,
    user: AuthUser,
    origin: ClientId,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, AppError> {
    state.notes.delete(&user.id, id).await?;
    let event = Event::new(&user.id, Kind::NoteDeleted, id, origin);
    state.events.publish(event);
    Ok(StatusCode::NO_CONTENT)
}
