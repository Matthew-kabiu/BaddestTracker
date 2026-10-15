//! HTTP adapters for /api/v1/calendar. Extract, call the service, publish the live event, respond.

use std::sync::Arc;

use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
};
use uuid::Uuid;

use super::model::{CreateEvent, RangeQuery, UpdateEvent};
use crate::{
    auth::AuthUser,
    error::AppError,
    events::{Event, Kind},
    http::extract::{ClientId, ValidQuery, ValidatedJson},
    http::respond,
    state::AppState,
};

/// GET /api/v1/calendar?from=YYYY-MM-DD&to=YYYY-MM-DD → occurrences
pub async fn list(
    State(state): State<Arc<AppState>>,
    user: AuthUser,
    ValidQuery(q): ValidQuery<RangeQuery>,
) -> Result<impl IntoResponse, AppError> {
    Ok(respond::ok(
        state.calendar.occurrences(&user.id, q.from, q.to).await?,
        "occurrences",
    ))
}

/// GET /api/v1/calendar/{id} → the series (for the edit form)
pub async fn get(
    State(state): State<Arc<AppState>>,
    user: AuthUser,
    Path(id): Path<Uuid>,
) -> Result<impl IntoResponse, AppError> {
    Ok(respond::ok(
        state.calendar.get(&user.id, id).await?,
        "event",
    ))
}

/// POST /api/v1/calendar
pub async fn create(
    State(state): State<Arc<AppState>>,
    user: AuthUser,
    origin: ClientId,
    ValidatedJson(body): ValidatedJson<CreateEvent>,
) -> Result<impl IntoResponse, AppError> {
    let created = state.calendar.create(&user.id, body).await?;
    let event = Event::new(&user.id, Kind::CalendarCreated, created.id, origin);
    state.events.publish(event);
    Ok(respond::created(created, "event created"))
}

/// PATCH /api/v1/calendar/{id}
pub async fn update(
    State(state): State<Arc<AppState>>,
    user: AuthUser,
    origin: ClientId,
    Path(id): Path<Uuid>,
    ValidatedJson(body): ValidatedJson<UpdateEvent>,
) -> Result<impl IntoResponse, AppError> {
    let updated = state.calendar.update(&user.id, id, body).await?;
    let event = Event::new(&user.id, Kind::CalendarUpdated, id, origin);
    state.events.publish(event);
    Ok(respond::ok(updated, "event updated"))
}

/// DELETE /api/v1/calendar/{id}
pub async fn remove(
    State(state): State<Arc<AppState>>,
    user: AuthUser,
    origin: ClientId,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, AppError> {
    state.calendar.delete(&user.id, id).await?;
    let event = Event::new(&user.id, Kind::CalendarDeleted, id, origin);
    state.events.publish(event);
    Ok(StatusCode::NO_CONTENT)
}
