//! `AuthUser` extractor: put it in a handler's arguments and the handler only runs for a
//! signed-in user. Missing or invalid session → 401 before the handler body executes.

use std::sync::Arc;

use axum::{extract::FromRequestParts, http::header, http::request::Parts};
use serde::Deserialize;

use crate::{error::AppError, state::AppState};

/// The signed-in user. `id` is Better Auth's user ID (text) — every owned row stores it.
#[derive(Debug, Clone)]
pub struct AuthUser {
    pub id: String,
    pub email: String,
}

#[derive(Deserialize)]
struct SessionResponse {
    user: SessionUser,
}

#[derive(Deserialize)]
struct SessionUser {
    id: String,
    email: String,
}

impl FromRequestParts<Arc<AppState>> for AuthUser {
    type Rejection = AppError;

    async fn from_request_parts(
        parts: &mut Parts,
        state: &Arc<AppState>,
    ) -> Result<Self, Self::Rejection> {
        let cookie = parts
            .headers
            .get(header::COOKIE)
            .and_then(|v| v.to_str().ok())
            .ok_or(AppError::Unauthorized)?;

        // Better Auth validates the signed session cookie, expiry, and revocation for us.
        let url = format!("{}/api/auth/get-session", state.config.auth_internal_url);
        let resp = state
            .http
            .get(url)
            .header(header::COOKIE, cookie)
            .send()
            .await
            .map_err(|e| {
                AppError::Internal(anyhow::Error::new(e).context("auth service unreachable"))
            })?;

        if !resp.status().is_success() {
            return Err(AppError::Unauthorized);
        }
        // Better Auth returns `null` (still 200) when there is no session.
        let session: Option<SessionResponse> = resp
            .json()
            .await
            .map_err(|e| AppError::Internal(anyhow::Error::new(e).context("decode session")))?;
        let user = session.ok_or(AppError::Unauthorized)?.user;
        Ok(AuthUser {
            id: user.id,
            email: user.email,
        })
    }
}
