//! Password vault, end-to-end encrypted (docs/Vault-Threat-Model.md). The browser encrypts;
//! this module stores and returns blobs it cannot read.

mod handler;
mod item_entity;
mod key_entity;
pub mod model;
mod repository;
mod service;

use std::sync::Arc;

use axum::{
    Router,
    routing::{delete, get, put},
};
use sea_orm::DatabaseConnection;

pub use service::Service;

use crate::state::AppState;

pub fn service(db: DatabaseConnection) -> Service {
    Service::new(repository::Repository::new(db))
}

/// Routes nested under `/api/v1/vault`.
pub fn routes() -> Router<Arc<AppState>> {
    Router::new()
        .route("/", delete(handler::wipe))
        .route("/key", get(handler::get_key).put(handler::put_key))
        .route("/items", get(handler::list).post(handler::create))
        .route("/items/{id}", put(handler::update).delete(handler::remove))
}
