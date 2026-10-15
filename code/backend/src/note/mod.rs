//! Notes. Owner-scoped CRUD.

mod entity;
mod handler;
pub mod model;
mod repository;
mod service;

use std::sync::Arc;

use axum::{
    Router,
    routing::{get, patch},
};
use sea_orm::DatabaseConnection;

pub use service::Service;

use crate::state::AppState;

pub fn service(db: DatabaseConnection) -> Service {
    Service::new(repository::Repository::new(db))
}

/// Routes nested under `/api/v1/notes`.
pub fn routes() -> Router<Arc<AppState>> {
    Router::new()
        .route("/", get(handler::list).post(handler::create))
        .route("/{id}", patch(handler::update).delete(handler::remove))
}
