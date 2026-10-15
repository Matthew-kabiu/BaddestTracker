//! Database access for `vault_keys` and `vault_items`. Every query is scoped by `user_id`.

use chrono::Utc;
use sea_orm::{
    ActiveModelTrait, ColumnTrait, DatabaseConnection, EntityTrait, PaginatorTrait, QueryFilter,
    QueryOrder, Set, TransactionTrait, sea_query::OnConflict,
};
use uuid::Uuid;

use super::item_entity::{self, Entity as Items};
use super::key_entity::{self, Entity as Keys};
use crate::error::AppError;

pub struct Repository {
    db: DatabaseConnection,
}

impl Repository {
    pub fn new(db: DatabaseConnection) -> Self {
        Self { db }
    }

    pub async fn key(&self, user_id: &str) -> Result<Option<key_entity::Model>, AppError> {
        Ok(Keys::find_by_id(user_id.to_owned()).one(&self.db).await?)
    }

    /// Set up, or replace after a master-password change or a recovery.
    pub async fn save_key(&self, row: key_entity::ActiveModel) -> Result<(), AppError> {
        Keys::insert(row)
            .on_conflict(
                OnConflict::column(key_entity::Column::UserId)
                    .update_columns([
                        key_entity::Column::Kdf,
                        key_entity::Column::KdfMemoryKib,
                        key_entity::Column::KdfIterations,
                        key_entity::Column::KdfParallelism,
                        key_entity::Column::Salt,
                        key_entity::Column::WrappedKey,
                        key_entity::Column::WrapNonce,
                        key_entity::Column::RecoveryWrappedKey,
                        key_entity::Column::RecoveryNonce,
                        key_entity::Column::UpdatedAt,
                    ])
                    .to_owned(),
            )
            .exec(&self.db)
            .await?;
        Ok(())
    }

    /// Delete the key and every item together (start over).
    pub async fn wipe(&self, user_id: &str) -> Result<(), AppError> {
        let txn = self.db.begin().await?;
        Items::delete_many()
            .filter(item_entity::Column::UserId.eq(user_id))
            .exec(&txn)
            .await?;
        Keys::delete_many()
            .filter(key_entity::Column::UserId.eq(user_id))
            .exec(&txn)
            .await?;
        txn.commit().await?;
        Ok(())
    }

    pub async fn items(&self, user_id: &str) -> Result<Vec<item_entity::Model>, AppError> {
        Ok(Items::find()
            .filter(item_entity::Column::UserId.eq(user_id))
            .order_by_asc(item_entity::Column::CreatedAt)
            .all(&self.db)
            .await?)
    }

    pub async fn count(&self, user_id: &str) -> Result<u64, AppError> {
        Ok(Items::find()
            .filter(item_entity::Column::UserId.eq(user_id))
            .count(&self.db)
            .await?)
    }

    pub async fn item_exists(&self, id: Uuid) -> Result<bool, AppError> {
        Ok(Items::find_by_id(id).one(&self.db).await?.is_some())
    }

    pub async fn item(
        &self,
        user_id: &str,
        id: Uuid,
    ) -> Result<Option<item_entity::Model>, AppError> {
        Ok(Items::find_by_id(id)
            .filter(item_entity::Column::UserId.eq(user_id))
            .one(&self.db)
            .await?)
    }

    pub async fn insert_item(
        &self,
        row: item_entity::ActiveModel,
    ) -> Result<item_entity::Model, AppError> {
        Ok(row.insert(&self.db).await?)
    }

    pub async fn update_item(
        &self,
        existing: item_entity::Model,
        ciphertext: Vec<u8>,
        nonce: Vec<u8>,
    ) -> Result<item_entity::Model, AppError> {
        let mut row: item_entity::ActiveModel = existing.into();
        row.ciphertext = Set(ciphertext);
        row.nonce = Set(nonce);
        row.updated_at = Set(Utc::now().fixed_offset());
        Ok(row.update(&self.db).await?)
    }

    pub async fn delete_item(&self, user_id: &str, id: Uuid) -> Result<bool, AppError> {
        let res = Items::delete_many()
            .filter(item_entity::Column::Id.eq(id))
            .filter(item_entity::Column::UserId.eq(user_id))
            .exec(&self.db)
            .await?;
        Ok(res.rows_affected > 0)
    }
}
