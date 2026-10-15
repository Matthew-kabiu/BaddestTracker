//! Database access for `shopping_items`. Every query is scoped by `user_id`.

use chrono::{NaiveDate, Utc};
use sea_orm::{
    ActiveModelTrait, ColumnTrait, DatabaseConnection, EntityTrait, QueryFilter, QueryOrder, Set,
};
use uuid::Uuid;

use super::entity::{self, Entity as Items};
use crate::error::AppError;

/// The fields a PATCH may change; `None` = leave alone.
pub struct Changes {
    pub name: Option<String>,
    pub quantity: Option<i32>,
    pub unit_price_cents: Option<Option<i64>>,
    pub bought_on: Option<Option<NaiveDate>>,
}

pub struct Repository {
    db: DatabaseConnection,
}

impl Repository {
    pub fn new(db: DatabaseConnection) -> Self {
        Self { db }
    }

    /// Still-to-buy first (newest first), then bought (most recently bought first).
    pub async fn list(&self, user_id: &str) -> Result<Vec<entity::Model>, AppError> {
        Ok(Items::find()
            .filter(entity::Column::UserId.eq(user_id))
            .order_by_asc(entity::Column::BoughtOn.is_not_null())
            .order_by_desc(entity::Column::BoughtOn)
            .order_by_desc(entity::Column::CreatedAt)
            .all(&self.db)
            .await?)
    }

    /// Items bought between `from` and `to` inclusive (for budget totals).
    pub async fn bought_between(
        &self,
        user_id: &str,
        from: NaiveDate,
        to: NaiveDate,
    ) -> Result<Vec<entity::Model>, AppError> {
        Ok(Items::find()
            .filter(entity::Column::UserId.eq(user_id))
            .filter(entity::Column::BoughtOn.between(from, to))
            .all(&self.db)
            .await?)
    }

    pub async fn find(&self, user_id: &str, id: Uuid) -> Result<Option<entity::Model>, AppError> {
        Ok(Items::find_by_id(id)
            .filter(entity::Column::UserId.eq(user_id))
            .one(&self.db)
            .await?)
    }

    pub async fn insert(
        &self,
        user_id: &str,
        name: String,
        quantity: i32,
        unit_price_cents: Option<i64>,
    ) -> Result<entity::Model, AppError> {
        let now = Utc::now().fixed_offset();
        let row = entity::ActiveModel {
            id: Set(Uuid::new_v4()),
            user_id: Set(user_id.to_owned()),
            name: Set(name),
            quantity: Set(quantity),
            unit_price_cents: Set(unit_price_cents),
            bought_on: Set(None),
            created_at: Set(now),
            updated_at: Set(now),
        };
        Ok(row.insert(&self.db).await?)
    }

    pub async fn update(
        &self,
        existing: entity::Model,
        changes: Changes,
    ) -> Result<entity::Model, AppError> {
        let mut row: entity::ActiveModel = existing.into();
        if let Some(v) = changes.name {
            row.name = Set(v);
        }
        if let Some(v) = changes.quantity {
            row.quantity = Set(v);
        }
        if let Some(v) = changes.unit_price_cents {
            row.unit_price_cents = Set(v);
        }
        if let Some(v) = changes.bought_on {
            row.bought_on = Set(v);
        }
        row.updated_at = Set(Utc::now().fixed_offset());
        Ok(row.update(&self.db).await?)
    }

    /// Returns whether a row was deleted (false = not found or not owned).
    pub async fn delete(&self, user_id: &str, id: Uuid) -> Result<bool, AppError> {
        let res = Items::delete_many()
            .filter(entity::Column::Id.eq(id))
            .filter(entity::Column::UserId.eq(user_id))
            .exec(&self.db)
            .await?;
        Ok(res.rows_affected > 0)
    }
}
