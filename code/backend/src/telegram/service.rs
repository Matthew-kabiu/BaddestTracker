//! Telegram delivery with the user's own bot (set up in Settings, never via env).
//! Linking: save the token → open the bot with a one-time code → confirm → we learn the chat.

use secrecy::SecretString;
use uuid::Uuid;

use super::api;
use super::entity;
use super::model::TelegramStatus;
use super::repository::Repository;
use crate::{
    crypto::{self, KeyCipher, Sealed},
    error::AppError,
};

/// AAD slot for the token ciphertext (see `crypto::aad`).
const SLOT: &str = "telegram";

pub struct Service {
    repo: Repository,
    http: reqwest::Client,
    cipher: KeyCipher,
}

impl Service {
    pub fn new(repo: Repository, http: reqwest::Client, cipher: KeyCipher) -> Self {
        Self { repo, http, cipher }
    }

    pub async fn status(&self, user_id: &str) -> Result<TelegramStatus, AppError> {
        Ok(status_of(self.repo.find(user_id).await?.as_ref()))
    }

    /// Check the token with Telegram, store it encrypted, and start a fresh link.
    pub async fn set_bot(
        &self,
        user_id: &str,
        token: SecretString,
    ) -> Result<TelegramStatus, AppError> {
        use secrecy::ExposeSecret;
        if !looks_like_token(token.expose_secret()) {
            return Err(AppError::Validation(
                "that does not look like a bot token (it is shaped 123456:ABC...)".into(),
            ));
        }
        let username = api::get_me(&self.http, &token)
            .await?
            .map_err(|_| AppError::Validation("Telegram did not accept that bot token".into()))?;
        let sealed = self.cipher.seal(&token, &crypto::aad(user_id, SLOT))?;
        // Telegram /start payloads allow [A-Za-z0-9_-], up to 64 characters.
        let code = Uuid::new_v4().simple().to_string();
        self.repo.save_bot(user_id, sealed, username, code).await?;
        self.status(user_id).await
    }

    /// Look for "/start <code>" in the bot's messages; link that chat and say hello.
    pub async fn confirm(&self, user_id: &str) -> Result<TelegramStatus, AppError> {
        let row = self.find(user_id).await?;
        if row.chat_id.is_some() {
            return Ok(status_of(Some(&row)));
        }
        let code = row.link_code.clone().unwrap_or_default();
        let token = self.token(&row)?;
        let updates = api::get_updates(&self.http, &token).await?.map_err(|why| {
            AppError::Validation(format!(
                "Telegram refused to share the bot's messages: {why}"
            ))
        })?;
        let expected = format!("/start {code}");
        let chat = updates
            .into_iter()
            .filter_map(|u| u.message)
            .find(|m| m.text.as_deref().map(str::trim) == Some(expected.as_str()))
            .map(|m| m.chat.id)
            .ok_or_else(|| {
                AppError::Validation(
                    "We have not seen the Start message yet. Open the link, press Start, then try again."
                        .into(),
                )
            })?;
        self.repo.set_chat(row.clone(), chat).await?;
        // A failed hello does not undo the link; the next notification will tell.
        let _ = api::send_message(
            &self.http,
            &token,
            chat,
            "Connected to Baddest Tracker. Reminders and alerts will arrive here.",
        )
        .await;
        self.status(user_id).await
    }

    pub async fn test(&self, user_id: &str) -> Result<(), AppError> {
        let row = self.find(user_id).await?;
        let chat = row
            .chat_id
            .ok_or_else(|| AppError::Validation("Telegram is not linked yet".into()))?;
        let token = self.token(&row)?;
        api::send_message(
            &self.http,
            &token,
            chat,
            "Test from Baddest Tracker: Telegram works.",
        )
        .await?
        .map_err(|why| AppError::Validation(format!("Telegram did not deliver it: {why}")))
    }

    pub async fn disconnect(&self, user_id: &str) -> Result<(), AppError> {
        if self.repo.delete(user_id).await? {
            Ok(())
        } else {
            Err(AppError::NotFound("telegram link"))
        }
    }

    /// Send a notification to the user's linked chat, if any. Never fails the caller: the
    /// in-app notification is already saved; a Telegram problem is only logged.
    pub async fn deliver(&self, user_id: &str, title: &str, body: &str) {
        let outcome = async {
            let Some(row) = self.repo.find(user_id).await? else {
                return Ok(());
            };
            let Some(chat) = row.chat_id else {
                return Ok(());
            };
            let token = self.token(&row)?;
            match api::send_message(&self.http, &token, chat, &format!("{title}\n{body}")).await? {
                Ok(()) => Ok(()),
                Err(why) => Err(AppError::Internal(anyhow::anyhow!("telegram send: {why}"))),
            }
        }
        .await;
        if let Err(e) = outcome {
            tracing::warn!(error = ?e, "telegram delivery failed");
        }
    }

    async fn find(&self, user_id: &str) -> Result<entity::Model, AppError> {
        self.repo
            .find(user_id)
            .await?
            .ok_or_else(|| AppError::Validation("Save your bot token first".into()))
    }

    fn token(&self, row: &entity::Model) -> Result<SecretString, AppError> {
        let sealed = Sealed {
            ciphertext: row.token_ciphertext.clone(),
            nonce: row.token_nonce.clone(),
        };
        self.cipher.open(&sealed, &crypto::aad(&row.user_id, SLOT))
    }
}

fn status_of(row: Option<&entity::Model>) -> TelegramStatus {
    match row {
        None => TelegramStatus {
            configured: false,
            bot_username: None,
            linked: false,
            link_url: None,
        },
        Some(r) => TelegramStatus {
            configured: true,
            bot_username: Some(r.bot_username.clone()),
            linked: r.chat_id.is_some(),
            link_url: match (&r.chat_id, &r.link_code) {
                (None, Some(code)) => Some(format!("https://t.me/{}?start={code}", r.bot_username)),
                _ => None,
            },
        },
    }
}

/// BotFather tokens look like `<digits>:<35 or so url-safe characters>`.
fn looks_like_token(t: &str) -> bool {
    let Some((id, secret)) = t.trim().split_once(':') else {
        return false;
    };
    !id.is_empty()
        && id.chars().all(|c| c.is_ascii_digit())
        && secret.len() >= 30
        && secret
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '_' || c == '-')
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn token_shape() {
        assert!(looks_like_token(
            "123456789:AAHdqTcvCH1vGWJxfSeofSAs0K5PALDsaw1"
        ));
        assert!(!looks_like_token("not-a-token"));
        assert!(!looks_like_token(
            "12ab:AAHdqTcvCH1vGWJxfSeofSAs0K5PALDsaw1"
        ));
        assert!(!looks_like_token("123:short"));
    }
}
