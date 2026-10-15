//! Vault rules. The server cannot decrypt anything here; it only checks that blobs have the
//! shapes the browser's crypto produces, and keeps each user to their own rows.

use chrono::Utc;
use sea_orm::Set;
use uuid::Uuid;

use super::item_entity;
use super::key_entity;
use super::model::{CreateItem, UpdateItem, VaultItem, VaultKey, bytes};
use super::repository::Repository;
use crate::error::AppError;

const SALT: std::ops::RangeInclusive<usize> = 16..=16;
/// XChaCha20-Poly1305 nonce.
const NONCE: std::ops::RangeInclusive<usize> = 24..=24;
/// A 32-byte key plus the 16-byte authentication tag.
const WRAPPED_KEY: std::ops::RangeInclusive<usize> = 48..=48;
/// One login, generously: 64 KiB of plaintext plus the tag.
const ITEM: std::ops::RangeInclusive<usize> = 17..=(64 * 1024 + 16);
const MAX_ITEMS: u64 = 5000;

pub struct Service {
    repo: Repository,
}

impl Service {
    pub fn new(repo: Repository) -> Self {
        Self { repo }
    }

    /// None until the user sets the vault up.
    pub async fn key(&self, user_id: &str) -> Result<Option<VaultKey>, AppError> {
        Ok(self.repo.key(user_id).await?.map(VaultKey::from))
    }

    pub async fn save_key(&self, user_id: &str, input: VaultKey) -> Result<VaultKey, AppError> {
        if input.kdf != "argon2id" {
            return Err(AppError::Validation("kdf must be argon2id".into()));
        }
        let p = input.kdf_params;
        // OWASP's Argon2id floor (19 MiB, 2 passes) up to 1 GiB / 10 passes.
        if !(19_456..=1_048_576).contains(&p.memory_kib)
            || !(2..=10).contains(&p.iterations)
            || !(1..=4).contains(&p.parallelism)
        {
            return Err(AppError::Validation("kdfParams are out of range".into()));
        }
        let now = Utc::now().fixed_offset();
        let row = key_entity::ActiveModel {
            user_id: Set(user_id.to_owned()),
            kdf: Set(input.kdf),
            kdf_memory_kib: Set(i32::try_from(p.memory_kib).unwrap_or(i32::MAX)),
            kdf_iterations: Set(i32::try_from(p.iterations).unwrap_or(i32::MAX)),
            kdf_parallelism: Set(i32::try_from(p.parallelism).unwrap_or(i32::MAX)),
            salt: Set(bytes("salt", &input.salt, SALT)?),
            wrapped_key: Set(bytes("wrappedKey", &input.wrapped_key, WRAPPED_KEY)?),
            wrap_nonce: Set(bytes("wrapNonce", &input.wrap_nonce, NONCE)?),
            recovery_wrapped_key: Set(bytes(
                "recoveryWrappedKey",
                &input.recovery_wrapped_key,
                WRAPPED_KEY,
            )?),
            recovery_nonce: Set(bytes("recoveryNonce", &input.recovery_nonce, NONCE)?),
            created_at: Set(now),
            updated_at: Set(now),
        };
        self.repo.save_key(row).await?;
        self.key(user_id)
            .await?
            .ok_or_else(|| AppError::Internal(anyhow::anyhow!("vault key vanished after save")))
    }

    /// Start over: the only way out when both the master password and the recovery key are lost.
    pub async fn wipe(&self, user_id: &str) -> Result<(), AppError> {
        self.repo.wipe(user_id).await
    }

    pub async fn items(&self, user_id: &str) -> Result<Vec<VaultItem>, AppError> {
        Ok(self
            .repo
            .items(user_id)
            .await?
            .into_iter()
            .map(VaultItem::from)
            .collect())
    }

    pub async fn create_item(
        &self,
        user_id: &str,
        input: CreateItem,
    ) -> Result<VaultItem, AppError> {
        self.require_key(user_id).await?;
        if self.repo.count(user_id).await? >= MAX_ITEMS {
            return Err(AppError::Validation(
                "the vault is full (5000 items)".into(),
            ));
        }
        // The id is client-chosen, so refuse one that exists (for anyone) rather than collide.
        if self.repo.item_exists(input.id).await? {
            return Err(AppError::Conflict("that item id is already used".into()));
        }
        let now = Utc::now().fixed_offset();
        let row = item_entity::ActiveModel {
            id: Set(input.id),
            user_id: Set(user_id.to_owned()),
            ciphertext: Set(bytes("ciphertext", &input.ciphertext, ITEM)?),
            nonce: Set(bytes("nonce", &input.nonce, NONCE)?),
            created_at: Set(now),
            updated_at: Set(now),
        };
        Ok(self.repo.insert_item(row).await?.into())
    }

    pub async fn update_item(
        &self,
        user_id: &str,
        id: Uuid,
        input: UpdateItem,
    ) -> Result<VaultItem, AppError> {
        let existing = self
            .repo
            .item(user_id, id)
            .await?
            .ok_or(AppError::NotFound("vault item"))?;
        let ciphertext = bytes("ciphertext", &input.ciphertext, ITEM)?;
        let nonce = bytes("nonce", &input.nonce, NONCE)?;
        Ok(self
            .repo
            .update_item(existing, ciphertext, nonce)
            .await?
            .into())
    }

    pub async fn delete_item(&self, user_id: &str, id: Uuid) -> Result<(), AppError> {
        if self.repo.delete_item(user_id, id).await? {
            Ok(())
        } else {
            Err(AppError::NotFound("vault item"))
        }
    }

    async fn require_key(&self, user_id: &str) -> Result<(), AppError> {
        if self.repo.key(user_id).await?.is_none() {
            return Err(AppError::Validation("set up the vault first".into()));
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use base64::{Engine, engine::general_purpose::STANDARD};

    use super::*;

    #[test]
    fn byte_fields_check_shape() {
        assert!(bytes("salt", &STANDARD.encode([0u8; 16]), SALT).is_ok());
        assert!(bytes("salt", &STANDARD.encode([0u8; 15]), SALT).is_err());
        assert!(bytes("nonce", "not base64!", NONCE).is_err());
        assert!(bytes("wrappedKey", &STANDARD.encode([0u8; 48]), WRAPPED_KEY).is_ok());
        assert!(bytes("ciphertext", &STANDARD.encode([0u8; 16]), ITEM).is_err());
    }
}
