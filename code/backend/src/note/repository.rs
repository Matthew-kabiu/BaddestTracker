//! Database access for `notes`. Every query is scoped by `user_id`.

use chrono::Utc;
use sea_orm::{
    ActiveModelTrait, ColumnTrait, DatabaseConnection, EntityTrait, QueryFilter, QueryOrder, Set,
};
use uuid::Uuid;

use super::entity::{self, Entity as Notes};
use crate::error::AppError;

pub struct Repository {
    db: DatabaseConnection,
}

impl Repository {
    pub fn new(db: DatabaseConnection) -> Self {
        Self { db }
    }

    pub async fn list(&self, user_id: &str) -> Result<Vec<entity::Model>, AppError> {
        Ok(Notes::find()
            .filter(entity::Column::UserId.eq(user_id))
            .order_by_desc(entity::Column::UpdatedAt)
            .all(&self.db)
            .await?)
    }

    pub async fn find(&self, user_id: &str, id: Uuid) -> Result<Option<entity::Model>, AppError> {
        Ok(Notes::find_by_id(id)
            .filter(entity::Column::UserId.eq(user_id))
            .one(&self.db)
            .await?)
    }

    pub async fn insert(
        &self,
        user_id: &str,
        title: String,
        body: String,
    ) -> Result<entity::Model, AppError> {
        let now = Utc::now().fixed_offset();
        let row = entity::ActiveModel {
            id: Set(Uuid::new_v4()),
            user_id: Set(user_id.to_owned()),
            title: Set(title),
            body: Set(body),
            created_at: Set(now),
            updated_at: Set(now),
        };
        Ok(row.insert(&self.db).await?)
    }

    pub async fn update(
        &self,
        existing: entity::Model,
        title: Option<String>,
        body: Option<String>,
    ) -> Result<entity::Model, AppError> {
        let mut row: entity::ActiveModel = existing.into();
        if let Some(t) = title {
            row.title = Set(t);
        }
        if let Some(b) = body {
            row.body = Set(b);
        }
        row.updated_at = Set(Utc::now().fixed_offset());
        Ok(row.update(&self.db).await?)
    }

    pub async fn delete(&self, user_id: &str, id: Uuid) -> Result<bool, AppError> {
        let res = Notes::delete_many()
            .filter(entity::Column::Id.eq(id))
            .filter(entity::Column::UserId.eq(user_id))
            .exec(&self.db)
            .await?;
        Ok(res.rows_affected > 0)
    }
}
