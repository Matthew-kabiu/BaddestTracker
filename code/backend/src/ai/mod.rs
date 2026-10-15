//! BYOK AI assistant. See docs/AI-Provider-Decision.md.
//! Vendor-specific types never leave this module: the rest of the app sees `types` only.

mod adapters;
mod entity;
mod handler;
pub mod provider;
mod registry;
mod repository;
mod service;
pub mod tools;
pub mod types;

use std::sync::Arc;

use axum::{
    Router,
    routing::{get, post, put},
};

use crate::state::AppState;

/// Routes nested under `/api/v1/ai`. Every handler requires a signed-in user.
pub fn routes() -> Router<Arc<AppState>> {
    Router::new()
        .route("/keys", get(handler::list_keys))
        .route(
            "/keys/{provider}",
            put(handler::put_key).delete(handler::delete_key),
        )
        .route("/chat", post(handler::chat))
}
