//! Telegram DTOs. JSON is camelCase to match the frontend. The token never leaves the server.

use secrecy::SecretString;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TelegramStatus {
    /// A bot token has been saved.
    pub configured: bool,
    pub bot_username: Option<String>,
    /// The user pressed Start and we know which chat to deliver to.
    pub linked: bool,
    /// Opens the bot with the one-time code; present until linked.
    pub link_url: Option<String>,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
pub struct SetBot {
    pub bot_token: SecretString,
}

// Manual: `SecretString` has no `Validate`; the token's shape is checked in the service.
impl validator::Validate for SetBot {
    fn validate(&self) -> Result<(), validator::ValidationErrors> {
        Ok(())
    }
}
