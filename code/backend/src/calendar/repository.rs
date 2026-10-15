//! Database access for `events` and `reminder_deliveries`. Event queries are scoped by
//! `user_id`; the reminder worker alone reads across users.

use chrono::{DateTime, Utc};
use sea_orm::{
    ActiveModelTrait, ColumnTrait, ConnectionTrait, DatabaseConnection, EntityTrait, QueryFilter,
    QueryOrder, Set, Statement,
};
use uuid::Uuid;

use super::entity::{self, Entity as Events};
use crate::error::AppError;

pub struct Repository {
    db: DatabaseConnection,
}

impl Repository {
    pub fn new(db: DatabaseConnection) -> Self {
        Self { db }
    }

    pub async fn list(&self, user_id: &str) -> Result<Vec<entity::Model>, AppError> {
        Ok(Events::find()
            .filter(entity::Column::UserId.eq(user_id))
            .order_by_asc(entity::Column::StartLocal)
            .all(&self.db)
            .await?)
    }

    pub async fn find(&self, user_id: &str, id: Uuid) -> Result<Option<entity::Model>, AppError> {
        Ok(Events::find_by_id(id)
            .filter(entity::Column::UserId.eq(user_id))
            .one(&self.db)
            .await?)
    }

    /// Every user's events that have a reminder (reminder worker only).
    pub async fn with_reminders(&self) -> Result<Vec<entity::Model>, AppError> {
        Ok(Events::find()
            .filter(entity::Column::ReminderMinutes.is_not_null())
            .all(&self.db)
            .await?)
    }

    pub async fn insert(&self, row: entity::ActiveModel) -> Result<entity::Model, AppError> {
        Ok(row.insert(&self.db).await?)
    }

    pub async fn update(&self, mut row: entity::ActiveModel) -> Result<entity::Model, AppError> {
        row.updated_at = Set(Utc::now().fixed_offset());
        Ok(row.update(&self.db).await?)
    }

    /// Returns whether a row was deleted (false = not found or not owned).
    pub async fn delete(&self, user_id: &str, id: Uuid) -> Result<bool, AppError> {
        let res = Events::delete_many()
            .filter(entity::Column::Id.eq(id))
            .filter(entity::Column::UserId.eq(user_id))
            .exec(&self.db)
            .await?;
        Ok(res.rows_affected > 0)
    }

    /// Record that the reminder for this occurrence is being sent. True only for the first
    /// caller, so a reminder is never sent twice, even across restarts.
    pub async fn claim_reminder(
        &self,
        event_id: Uuid,
        occurrence_start: DateTime<Utc>,
    ) -> Result<bool, AppError> {
        let res = self
            .db
            .execute_raw(Statement::from_sql_and_values(
                self.db.get_database_backend(),
                "INSERT INTO reminder_deliveries (event_id, occurrence_start) VALUES ($1, $2) \
                 ON CONFLICT DO NOTHING",
                [event_id.into(), occurrence_start.into()],
            ))
            .await?;
        Ok(res.rows_affected() == 1)
    }
}
