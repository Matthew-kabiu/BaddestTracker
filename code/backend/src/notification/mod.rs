//! In-app notifications: saved per user, listed in the bell panel, pushed live over SSE.
//! Other modules raise one with `Service::notify`, which also delivers to linked channels
//! (Telegram today; email later).

mod entity;
mod handler;
pub mod model;
mod repository;
mod service;

use std::sync::Arc;

use axum::{
    Router,
    routing::{get, patch, post},
};
use sea_orm::DatabaseConnection;

pub use model::NewNotification;
pub use service::Service;

use crate::{events, state::AppState, telegram};

pub fn service(
    db: DatabaseConnection,
    events: events::Hub,
    telegram: Arc<telegram::Service>,
) -> Service {
    Service::new(repository::Repository::new(db), events, telegram)
}

/// Routes nested under `/api/v1/notifications`.
pub fn routes() -> Router<Arc<AppState>> {
    Router::new()
        .route("/", get(handler::list))
        .route("/read-all", post(handler::read_all))
        .route("/{id}", patch(handler::update).delete(handler::remove))
}
