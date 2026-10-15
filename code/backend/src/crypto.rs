//! Encrypts users' stored secrets at rest (BYOK AI provider keys, Telegram bot tokens) with
//! XChaCha20-Poly1305, using the app data key `AI_KEYS_ENCRYPTION_KEY`.
//!
//! Trust model (docs/AI-Provider-Decision.md rule 3): this is NOT end-to-end. The server must
//! use the secrets, so it holds the data key (`AI_KEYS_ENCRYPTION_KEY`). Encryption protects a
//! leaked database dump, not a compromised server.
//!
//! Each ciphertext is bound to its row via AAD = "<user_id>:<slot>" (slot = provider name or
//! "telegram"), so a ciphertext copied into another user's row or slot fails to decrypt.

use base64::Engine;
use chacha20poly1305::{
    XChaCha20Poly1305, XNonce,
    aead::{Aead, Generate, KeyInit, Payload},
};
use secrecy::{ExposeSecret, SecretString};

use crate::error::AppError;

pub struct KeyCipher(XChaCha20Poly1305);

pub struct Sealed {
    pub ciphertext: Vec<u8>,
    pub nonce: Vec<u8>,
}

impl KeyCipher {
    /// `key_b64` is the standard-base64 encoding of exactly 32 random bytes.
    pub fn from_base64(key_b64: &SecretString) -> Result<Self, AppError> {
        let raw = base64::engine::general_purpose::STANDARD
            .decode(key_b64.expose_secret().trim())
            .map_err(|_| {
                AppError::Internal(anyhow::anyhow!(
                    "AI_KEYS_ENCRYPTION_KEY is not valid base64"
                ))
            })?;
        let cipher = XChaCha20Poly1305::new_from_slice(&raw).map_err(|_| {
            AppError::Internal(anyhow::anyhow!(
                "AI_KEYS_ENCRYPTION_KEY must decode to 32 bytes"
            ))
        })?;
        Ok(Self(cipher))
    }

    pub fn seal(&self, plaintext: &SecretString, aad: &str) -> Result<Sealed, AppError> {
        let nonce = XNonce::generate(); // random 24-byte nonce: safe to generate per message
        let ciphertext = self
            .0
            .encrypt(
                &nonce,
                Payload {
                    msg: plaintext.expose_secret().as_bytes(),
                    aad: aad.as_bytes(),
                },
            )
            .map_err(|_| AppError::Internal(anyhow::anyhow!("encrypt secret")))?;
        Ok(Sealed {
            ciphertext,
            nonce: nonce.to_vec(),
        })
    }

    pub fn open(&self, sealed: &Sealed, aad: &str) -> Result<SecretString, AppError> {
        let nonce = XNonce::try_from(sealed.nonce.as_slice())
            .map_err(|_| AppError::Internal(anyhow::anyhow!("stored nonce has wrong length")))?;
        let plain = self
            .0
            .decrypt(
                &nonce,
                Payload {
                    msg: &sealed.ciphertext,
                    aad: aad.as_bytes(),
                },
            )
            .map_err(|_| AppError::Internal(anyhow::anyhow!("decrypt secret")))?;
        let text = String::from_utf8(plain)
            .map_err(|_| AppError::Internal(anyhow::anyhow!("secret is not UTF-8")))?;
        Ok(SecretString::from(text))
    }
}

/// AAD binding a ciphertext to one user's slot (a provider name, or "telegram").
pub fn aad(user_id: &str, slot: &str) -> String {
    format!("{user_id}:{slot}")
}

#[cfg(test)]
#[allow(clippy::unwrap_used)] // tests may unwrap: a panic is a test failure
mod tests {
    use super::*;

    fn cipher() -> KeyCipher {
        let key = base64::engine::general_purpose::STANDARD.encode([7u8; 32]);
        KeyCipher::from_base64(&SecretString::from(key)).unwrap()
    }

    #[test]
    fn round_trips() {
        let c = cipher();
        let sealed = c
            .seal(&SecretString::from("sk-test-123"), "u1:openai")
            .unwrap();
        assert_ne!(sealed.ciphertext, b"sk-test-123");
        let opened = c.open(&sealed, "u1:openai").unwrap();
        assert_eq!(opened.expose_secret(), "sk-test-123");
    }

    #[test]
    fn rejects_ciphertext_moved_to_another_row() {
        let c = cipher();
        let sealed = c
            .seal(&SecretString::from("sk-test-123"), "u1:openai")
            .unwrap();
        assert!(c.open(&sealed, "u2:openai").is_err());
        assert!(c.open(&sealed, "u1:anthropic").is_err());
    }

    #[test]
    fn nonces_are_unique() {
        let c = cipher();
        let a = c.seal(&SecretString::from("k"), "x").unwrap();
        let b = c.seal(&SecretString::from("k"), "x").unwrap();
        assert_ne!(a.nonce, b.nonce);
    }

    #[test]
    fn rejects_wrong_key_length() {
        let short = base64::engine::general_purpose::STANDARD.encode([1u8; 16]);
        assert!(KeyCipher::from_base64(&SecretString::from(short)).is_err());
    }
}
