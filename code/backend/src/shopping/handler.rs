//! HTTP adapters for /api/v1/shopping. Extract, call the service, publish the live event, respond.

use std::sync::Arc;

use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
};
use uuid::Uuid;

use super::model::{CreateShoppingItem, UpdateShoppingItem};
use crate::{
    auth::AuthUser,
    error::AppError,
    events::{Event, Kind},
    http::extract::{ClientId, ValidatedJson},
    http::respond,
    state::AppState,
};

/// GET /api/v1/shopping
pub async fn list(
    State(state): State<Arc<AppState>>,
    user: AuthUser,
) -> Result<impl IntoResponse, AppError> {
    Ok(respond::ok(
        state.shopping.list(&user.id).await?,
        "shopping items",
    ))
}

/// POST /api/v1/shopping
pub async fn create(
    State(state): State<Arc<AppState>>,
    user: AuthUser,
    origin: ClientId,
    ValidatedJson(body): ValidatedJson<CreateShoppingItem>,
) -> Result<impl IntoResponse, AppError> {
    let created = state.shopping.create(&user.id, body).await?;
    let event = Event::new(&user.id, Kind::ShoppingCreated, created.id, origin);
    state.events.publish(event);
    Ok(respond::created(created, "shopping item created"))
}

/// PATCH /api/v1/shopping/{id}
pub async fn update(
    State(state): State<Arc<AppState>>,
    user: AuthUser,
    origin: ClientId,
    Path(id): Path<Uuid>,
    ValidatedJson(body): ValidatedJson<UpdateShoppingItem>,
) -> Result<impl IntoResponse, AppError> {
    let updated = state.shopping.update(&user.id, id, body).await?;
    // A purchase (or a price change on one) may push a shopping-linked budget over.
    if let Some(day) = updated.bought_on {
        state.budgets.check_alerts(&user.id, day).await;
    }
    let event = Event::new(&user.id, Kind::ShoppingUpdated, id, origin);
    state.events.publish(event);
    Ok(respond::ok(updated, "shopping item updated"))
}

/// DELETE /api/v1/shopping/{id}
pub async fn remove(
    State(state): State<Arc<AppState>>,
    user: AuthUser,
    origin: ClientId,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, AppError> {
    state.shopping.delete(&user.id, id).await?;
    let event = Event::new(&user.id, Kind::ShoppingDeleted, id, origin);
    state.events.publish(event);
    Ok(StatusCode::NO_CONTENT)
}
