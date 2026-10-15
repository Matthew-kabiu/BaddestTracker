//! Database access for `ai_provider_keys`. Queries only — no crypto, no rules.

use sea_orm::{
    ActiveModelTrait, ColumnTrait, DatabaseConnection, EntityTrait, QueryFilter, QueryOrder, Set,
};
use uuid::Uuid;

use super::entity::{self, Entity as ProviderKeys};
use crate::error::AppError;

pub struct Repository {
    db: DatabaseConnection,
}

pub struct NewKey<'a> {
    pub user_id: &'a str,
    pub provider: &'a str,
    pub model: &'a str,
    pub ciphertext: Vec<u8>,
    pub nonce: Vec<u8>,
}

impl Repository {
    pub fn new(db: DatabaseConnection) -> Self {
        Self { db }
    }

    pub async fn find(
        &self,
        user_id: &str,
        provider: &str,
    ) -> Result<Option<entity::Model>, AppError> {
        Ok(ProviderKeys::find()
            .filter(entity::Column::UserId.eq(user_id))
            .filter(entity::Column::Provider.eq(provider))
            .one(&self.db)
            .await?)
    }

    pub async fn list(&self, user_id: &str) -> Result<Vec<entity::Model>, AppError> {
        Ok(ProviderKeys::find()
            .filter(entity::Column::UserId.eq(user_id))
            .order_by_asc(entity::Column::Provider)
            .all(&self.db)
            .await?)
    }

    /// Insert, or replace the key + model if the user already has one for this provider.
    pub async fn upsert(&self, new: NewKey<'_>) -> Result<entity::Model, AppError> {
        let now = chrono::Utc::now().fixed_offset();
        let saved = match self.find(new.user_id, new.provider).await? {
            Some(existing) => {
                let mut active: entity::ActiveModel = existing.into();
                active.model = Set(new.model.to_owned());
                active.ciphertext = Set(new.ciphertext);
                active.nonce = Set(new.nonce);
                active.updated_at = Set(now);
                active.update(&self.db).await?
            }
            None => {
                entity::ActiveModel {
                    id: Set(Uuid::new_v4()),
                    user_id: Set(new.user_id.to_owned()),
                    provider: Set(new.provider.to_owned()),
                    model: Set(new.model.to_owned()),
                    ciphertext: Set(new.ciphertext),
                    nonce: Set(new.nonce),
                    created_at: Set(now),
                    updated_at: Set(now),
                }
                .insert(&self.db)
                .await?
            }
        };
        Ok(saved)
    }

    /// Returns whether a row was deleted.
    pub async fn delete(&self, user_id: &str, provider: &str) -> Result<bool, AppError> {
        let res = ProviderKeys::delete_many()
            .filter(entity::Column::UserId.eq(user_id))
            .filter(entity::Column::Provider.eq(provider))
            .exec(&self.db)
            .await?;
        Ok(res.rows_affected > 0)
    }
}
