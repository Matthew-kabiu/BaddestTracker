//! Request extractors shared by every module.
//! `ValidatedJson<T>`: parse the JSON body into `T` and run its `validator` rules.
//! Like zod on `req.body`: a bad body is a 400 before the handler runs.

use std::convert::Infallible;

use axum::{
    Json,
    extract::{FromRequest, FromRequestParts, Query, Request},
    http::request::Parts,
};
use serde::de::DeserializeOwned;
use validator::Validate;

use crate::error::AppError;

pub struct ValidatedJson<T>(pub T);

impl<S, T> FromRequest<S> for ValidatedJson<T>
where
    S: Send + Sync,
    T: DeserializeOwned + Validate,
{
    type Rejection = AppError;

    async fn from_request(req: Request, state: &S) -> Result<Self, Self::Rejection> {
        let Json(value) = Json::<T>::from_request(req, state)
            .await
            .map_err(|_| AppError::Validation("malformed request body".into()))?;
        value
            .validate()
            .map_err(|e| AppError::Validation(field_summary(&e)))?;
        Ok(Self(value))
    }
}

/// "title: length" style summary — field names only, never echoing the submitted values.
fn field_summary(errors: &validator::ValidationErrors) -> String {
    // `field_errors()` builds a new map; bind it so the keys we borrow outlive this line.
    let field_errors = errors.field_errors();
    let mut fields: Vec<&str> = field_errors.keys().map(|k| k.as_ref()).collect();
    fields.sort_unstable();
    format!("invalid fields: {}", fields.join(", "))
}

/// `ValidQuery<T>`: parse the query string into `T`. A missing or malformed parameter is our
/// standard 400 envelope rather than Axum's plain-text rejection.
pub struct ValidQuery<T>(pub T);

impl<S, T> FromRequestParts<S> for ValidQuery<T>
where
    S: Send + Sync,
    T: DeserializeOwned,
{
    type Rejection = AppError;

    async fn from_request_parts(parts: &mut Parts, state: &S) -> Result<Self, Self::Rejection> {
        let Query(value) = Query::<T>::from_request_parts(parts, state)
            .await
            .map_err(|_| AppError::Validation("missing or invalid query parameters".into()))?;
        Ok(Self(value))
    }
}

/// The browser tab that sent the request (`X-Client-Id`, a random id per tab). Optional and
/// untrusted: it only lets a tab recognise its own live events. Anything odd is ignored.
pub struct ClientId(pub Option<String>);

impl<S: Send + Sync> FromRequestParts<S> for ClientId {
    type Rejection = Infallible;

    async fn from_request_parts(parts: &mut Parts, _: &S) -> Result<Self, Self::Rejection> {
        let id = parts
            .headers
            .get("x-client-id")
            .and_then(|v| v.to_str().ok())
            .filter(|v| {
                !v.is_empty()
                    && v.len() <= 64
                    && v.chars().all(|c| c.is_ascii_alphanumeric() || c == '-')
            })
            .map(str::to_owned);
        Ok(Self(id))
    }
}
