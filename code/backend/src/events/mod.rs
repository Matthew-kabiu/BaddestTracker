//! Live events: tells a user's open tabs and devices that their data changed, over
//! Server-Sent Events. Handlers publish after a successful write; the stream fans them out.

mod handler;
mod hub;

use std::sync::Arc;

use axum::{Router, routing::get};

pub use hub::{Event, Hub, Kind};

use crate::state::AppState;

/// Routes nested under `/api/v1/events`.
pub fn routes() -> Router<Arc<AppState>> {
    Router::new().route("/", get(handler::stream))
}
