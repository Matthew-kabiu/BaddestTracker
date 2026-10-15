//! The three Telegram Bot API calls we use, over the shared reqwest client.
//! The bot token is part of every URL, so errors are always stripped of their URL before they
//! can reach a log line.

use secrecy::{ExposeSecret, SecretString};
use serde::Deserialize;
use serde_json::json;

use crate::error::AppError;

const BASE: &str = "https://api.telegram.org";

#[derive(Deserialize)]
struct Reply<T> {
    ok: bool,
    result: Option<T>,
    description: Option<String>,
}

#[derive(Deserialize)]
struct Me {
    username: String,
}

#[derive(Deserialize)]
pub struct Update {
    pub message: Option<Message>,
}

#[derive(Deserialize)]
pub struct Message {
    pub chat: Chat,
    pub text: Option<String>,
}

#[derive(Deserialize)]
pub struct Chat {
    pub id: i64,
}

/// A failed Telegram call, safe to log: never contains the token.
fn failed(what: &str, detail: impl std::fmt::Display) -> AppError {
    AppError::Internal(anyhow::anyhow!("telegram {what}: {detail}"))
}

async fn call<T: for<'de> Deserialize<'de>>(
    http: &reqwest::Client,
    token: &SecretString,
    method: &str,
    body: serde_json::Value,
) -> Result<Result<T, String>, AppError> {
    let url = format!("{BASE}/bot{}/{method}", token.expose_secret());
    let resp = http
        .post(url)
        .json(&body)
        .send()
        .await
        .map_err(|e| failed(method, e.without_url()))?;
    let reply: Reply<T> = resp
        .json()
        .await
        .map_err(|e| failed(method, e.without_url()))?;
    Ok(match (reply.ok, reply.result) {
        (true, Some(r)) => Ok(r),
        _ => Err(reply.description.unwrap_or_else(|| "unknown error".into())),
    })
}

/// The bot's @username, or the reason Telegram rejected the token.
pub async fn get_me(
    http: &reqwest::Client,
    token: &SecretString,
) -> Result<Result<String, String>, AppError> {
    Ok(call::<Me>(http, token, "getMe", json!({}))
        .await?
        .map(|m| m.username))
}

/// Pending messages sent to the bot (no long polling: one quick look).
pub async fn get_updates(
    http: &reqwest::Client,
    token: &SecretString,
) -> Result<Result<Vec<Update>, String>, AppError> {
    call(
        http,
        token,
        "getUpdates",
        json!({ "timeout": 0, "limit": 100 }),
    )
    .await
}

pub async fn send_message(
    http: &reqwest::Client,
    token: &SecretString,
    chat_id: i64,
    text: &str,
) -> Result<Result<(), String>, AppError> {
    let sent = call::<serde_json::Value>(
        http,
        token,
        "sendMessage",
        json!({ "chat_id": chat_id, "text": text, "disable_web_page_preview": true }),
    )
    .await?;
    Ok(sent.map(|_| ()))
}
