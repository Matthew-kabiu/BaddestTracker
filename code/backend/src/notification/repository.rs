//! Database access for `notifications`. Every query is scoped by `user_id`.

use chrono::Utc;
use sea_orm::{
    ActiveModelTrait, ColumnTrait, DatabaseConnection, EntityTrait, PaginatorTrait, QueryFilter,
    QueryOrder, QuerySelect, Set, sea_query::Expr,
};
use uuid::Uuid;

use super::entity::{self, Entity as Notifications};
use super::model::NewNotification;
use crate::error::AppError;

/// The bell panel shows this many; older ones stay in the table.
const LIST_LIMIT: u64 = 50;

pub struct Repository {
    db: DatabaseConnection,
}

impl Repository {
    pub fn new(db: DatabaseConnection) -> Self {
        Self { db }
    }

    pub async fn latest(&self, user_id: &str) -> Result<Vec<entity::Model>, AppError> {
        Ok(Notifications::find()
            .filter(entity::Column::UserId.eq(user_id))
            .order_by_desc(entity::Column::CreatedAt)
            .limit(LIST_LIMIT)
            .all(&self.db)
            .await?)
    }

    pub async fn unread_count(&self, user_id: &str) -> Result<u64, AppError> {
        Ok(Notifications::find()
            .filter(entity::Column::UserId.eq(user_id))
            .filter(entity::Column::ReadAt.is_null())
            .count(&self.db)
            .await?)
    }

    pub async fn find(&self, user_id: &str, id: Uuid) -> Result<Option<entity::Model>, AppError> {
        Ok(Notifications::find_by_id(id)
            .filter(entity::Column::UserId.eq(user_id))
            .one(&self.db)
            .await?)
    }

    pub async fn insert(
        &self,
        user_id: &str,
        new: NewNotification,
    ) -> Result<entity::Model, AppError> {
        let row = entity::ActiveModel {
            id: Set(Uuid::new_v4()),
            user_id: Set(user_id.to_owned()),
            kind: Set(new.kind.to_owned()),
            title: Set(new.title),
            body: Set(new.body),
            link: Set(new.link.map(str::to_owned)),
            read_at: Set(None),
            created_at: Set(Utc::now().fixed_offset()),
        };
        Ok(row.insert(&self.db).await?)
    }

    pub async fn set_read(
        &self,
        existing: entity::Model,
        read: bool,
    ) -> Result<entity::Model, AppError> {
        let mut row: entity::ActiveModel = existing.into();
        row.read_at = Set(read.then(|| Utc::now().fixed_offset()));
        Ok(row.update(&self.db).await?)
    }

    pub async fn mark_all_read(&self, user_id: &str) -> Result<(), AppError> {
        Notifications::update_many()
            .col_expr(
                entity::Column::ReadAt,
                Expr::value(Utc::now().fixed_offset()),
            )
            .filter(entity::Column::UserId.eq(user_id))
            .filter(entity::Column::ReadAt.is_null())
            .exec(&self.db)
            .await?;
        Ok(())
    }

    /// Returns whether a row was deleted (false = not found or not owned).
    pub async fn delete(&self, user_id: &str, id: Uuid) -> Result<bool, AppError> {
        let res = Notifications::delete_many()
            .filter(entity::Column::Id.eq(id))
            .filter(entity::Column::UserId.eq(user_id))
            .exec(&self.db)
            .await?;
        Ok(res.rows_affected > 0)
    }
}
