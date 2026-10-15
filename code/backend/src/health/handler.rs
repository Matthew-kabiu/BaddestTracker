use std::sync::Arc;

use axum::{extract::State, http::StatusCode, response::IntoResponse};
use serde::Serialize;

use crate::{http::respond, state::AppState};

#[derive(Serialize)]
struct Health {
    status: &'static str,
    database: &'static str,
}

/// GET /api/health — 200 when the database answers, 503 otherwise.
pub async fn check(State(state): State<Arc<AppState>>) -> impl IntoResponse {
    match state.db.ping().await {
        Ok(()) => respond::ok(
            Health {
                status: "ok",
                database: "up",
            },
            "healthy",
        ),
        Err(e) => {
            tracing::warn!(error = ?e, "database ping failed");
            respond::with_status(
                StatusCode::SERVICE_UNAVAILABLE,
                Health {
                    status: "degraded",
                    database: "down",
                },
                "unhealthy",
            )
        }
    }
}
