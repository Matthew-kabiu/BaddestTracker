//! HTTP adapters for /api/v1/todos. Extract, call the service, publish the live event, respond.

use std::sync::Arc;

use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
};
use uuid::Uuid;

use super::model::{CreateTodo, UpdateTodo};
use crate::{
    auth::AuthUser,
    error::AppError,
    events::{Event, Kind},
    http::extract::{ClientId, ValidatedJson},
    http::respond,
    state::AppState,
};

/// GET /api/v1/todos
pub async fn list(
    State(state): State<Arc<AppState>>,
    user: AuthUser,
) -> Result<impl IntoResponse, AppError> {
    Ok(respond::ok(state.todos.list(&user.id).await?, "to-dos"))
}

/// POST /api/v1/todos
pub async fn create(
    State(state): State<Arc<AppState>>,
    user: AuthUser,
    origin: ClientId,
    ValidatedJson(body): ValidatedJson<CreateTodo>,
) -> Result<impl IntoResponse, AppError> {
    let created = state.todos.create(&user.id, body).await?;
    let event = Event::new(&user.id, Kind::TodoCreated, created.id, origin);
    state.events.publish(event);
    Ok(respond::created(created, "to-do created"))
}

/// PATCH /api/v1/todos/{id}
pub async fn update(
    State(state): State<Arc<AppState>>,
    user: AuthUser,
    origin: ClientId,
    Path(id): Path<Uuid>,
    ValidatedJson(body): ValidatedJson<UpdateTodo>,
) -> Result<impl IntoResponse, AppError> {
    let updated = state.todos.update(&user.id, id, body).await?;
    let event = Event::new(&user.id, Kind::TodoUpdated, id, origin);
    state.events.publish(event);
    Ok(respond::ok(updated, "to-do updated"))
}

/// DELETE /api/v1/todos/{id}
pub async fn remove(
    State(state): State<Arc<AppState>>,
    user: AuthUser,
    origin: ClientId,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, AppError> {
    state.todos.delete(&user.id, id).await?;
    let event = Event::new(&user.id, Kind::TodoDeleted, id, origin);
    state.events.publish(event);
    Ok(StatusCode::NO_CONTENT)
}
