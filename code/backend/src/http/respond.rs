//! Response envelope, identical in shape to the Node and Go templates.
//! The request ID travels in the `x-request-id` response header rather than the body.

use axum::{Json, http::StatusCode};
use serde::Serialize;

#[derive(Serialize)]
pub struct Success<T: Serialize> {
    success: bool,
    message: String,
    data: T,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Failure {
    success: bool,
    error: &'static str,
    message: String,
    status_code: u16,
    timestamp: String,
}

pub fn ok<T: Serialize>(data: T, message: &str) -> (StatusCode, Json<Success<T>>) {
    with_status(StatusCode::OK, data, message)
}

pub fn created<T: Serialize>(data: T, message: &str) -> (StatusCode, Json<Success<T>>) {
    with_status(StatusCode::CREATED, data, message)
}

pub fn with_status<T: Serialize>(
    status: StatusCode,
    data: T,
    message: &str,
) -> (StatusCode, Json<Success<T>>) {
    let body = Success {
        success: true,
        message: message.to_owned(),
        data,
    };
    (status, Json(body))
}

pub fn error(
    status: StatusCode,
    code: &'static str,
    message: String,
) -> (StatusCode, Json<Failure>) {
    let body = Failure {
        success: false,
        error: code,
        message,
        status_code: status.as_u16(),
        timestamp: chrono::Utc::now().to_rfc3339(),
    };
    (status, Json(body))
}
