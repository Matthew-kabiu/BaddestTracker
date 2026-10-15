//! Telegram: notifications delivered through the user's own bot. Optional, configured in
//! Settings; nothing about it lives in the environment.

mod api;
mod entity;
mod handler;
pub mod model;
mod repository;
mod service;

use std::sync::Arc;

use axum::{
    Router,
    routing::{get, post},
};
use sea_orm::DatabaseConnection;

pub use service::Service;

use crate::{crypto::KeyCipher, state::AppState};

pub fn service(db: DatabaseConnection, http: reqwest::Client, cipher: KeyCipher) -> Service {
    Service::new(repository::Repository::new(db), http, cipher)
}

/// Routes nested under `/api/v1/telegram`.
pub fn routes() -> Router<Arc<AppState>> {
    Router::new()
        .route(
            "/",
            get(handler::status)
                .put(handler::set_bot)
                .delete(handler::disconnect),
        )
        .route("/confirm", post(handler::confirm))
        .route("/test", post(handler::test))
}
