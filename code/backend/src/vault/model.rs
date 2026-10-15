//! Vault DTOs. Every byte field is standard base64 of data the browser encrypted; the server
//! cannot read any of it. JSON is camelCase to match the frontend.

use base64::{Engine, engine::general_purpose::STANDARD};
use chrono::{DateTime, FixedOffset};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use super::{item_entity, key_entity};
use crate::error::AppError;

/// Argon2id cost, chosen by the browser. Bounds keep it between OWASP's minimum and 1 GiB.
#[derive(Clone, Copy, Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
pub struct KdfParams {
    pub memory_kib: u32,
    pub iterations: u32,
    pub parallelism: u32,
}

/// Everything needed to unlock (with the master password) or recover (with the recovery key).
#[derive(Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
pub struct VaultKey {
    /// Always "argon2id" today.
    pub kdf: String,
    pub kdf_params: KdfParams,
    pub salt: String,
    pub wrapped_key: String,
    pub wrap_nonce: String,
    pub recovery_wrapped_key: String,
    pub recovery_nonce: String,
}

impl From<key_entity::Model> for VaultKey {
    fn from(m: key_entity::Model) -> Self {
        Self {
            kdf: m.kdf,
            kdf_params: KdfParams {
                memory_kib: u32::try_from(m.kdf_memory_kib).unwrap_or(0),
                iterations: u32::try_from(m.kdf_iterations).unwrap_or(0),
                parallelism: u32::try_from(m.kdf_parallelism).unwrap_or(0),
            },
            salt: STANDARD.encode(m.salt),
            wrapped_key: STANDARD.encode(m.wrapped_key),
            wrap_nonce: STANDARD.encode(m.wrap_nonce),
            recovery_wrapped_key: STANDARD.encode(m.recovery_wrapped_key),
            recovery_nonce: STANDARD.encode(m.recovery_nonce),
        }
    }
}

// The body carries only base64 strings; their shapes are checked in the service.
impl validator::Validate for VaultKey {
    fn validate(&self) -> Result<(), validator::ValidationErrors> {
        Ok(())
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VaultItem {
    pub id: Uuid,
    pub ciphertext: String,
    pub nonce: String,
    pub created_at: DateTime<FixedOffset>,
    pub updated_at: DateTime<FixedOffset>,
}

impl From<item_entity::Model> for VaultItem {
    fn from(m: item_entity::Model) -> Self {
        Self {
            id: m.id,
            ciphertext: STANDARD.encode(m.ciphertext),
            nonce: STANDARD.encode(m.nonce),
            created_at: m.created_at,
            updated_at: m.updated_at,
        }
    }
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
pub struct CreateItem {
    /// Made by the browser and bound into the item's encryption (AAD).
    pub id: Uuid,
    pub ciphertext: String,
    pub nonce: String,
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
pub struct UpdateItem {
    pub ciphertext: String,
    pub nonce: String,
}

impl validator::Validate for CreateItem {
    fn validate(&self) -> Result<(), validator::ValidationErrors> {
        Ok(())
    }
}

impl validator::Validate for UpdateItem {
    fn validate(&self) -> Result<(), validator::ValidationErrors> {
        Ok(())
    }
}

/// Decode a base64 field and require an exact or bounded length.
pub fn bytes(
    field: &str,
    value: &str,
    len: std::ops::RangeInclusive<usize>,
) -> Result<Vec<u8>, AppError> {
    let raw = STANDARD
        .decode(value)
        .map_err(|_| AppError::Validation(format!("{field} is not valid base64")))?;
    if !len.contains(&raw.len()) {
        return Err(AppError::Validation(format!(
            "{field} has the wrong length"
        )));
    }
    Ok(raw)
}
