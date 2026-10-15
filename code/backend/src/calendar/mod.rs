//! Calendar: single and repeating events (RFC 5545 style), with reminders delivered through
//! notifications by the in-process reminder worker.

mod entity;
mod handler;
pub mod model;
pub mod recurrence;
pub mod reminders;
mod repository;
mod service;

use std::sync::Arc;

use axum::{Router, routing::get};
use sea_orm::DatabaseConnection;

pub use service::Service;

use crate::state::AppState;

pub fn service(db: DatabaseConnection) -> Service {
    Service::new(repository::Repository::new(db))
}

/// Routes nested under `/api/v1/calendar`.
pub fn routes() -> Router<Arc<AppState>> {
    Router::new()
        .route("/", get(handler::list).post(handler::create))
        .route(
            "/{id}",
            get(handler::get)
                .patch(handler::update)
                .delete(handler::remove),
        )
}
