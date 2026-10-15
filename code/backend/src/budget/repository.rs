//! Database access for `budgets` and `expenses`. Every query is scoped by `user_id`.

use chrono::{NaiveDate, Utc};
use sea_orm::{
    ActiveModelTrait, ColumnTrait, DatabaseConnection, EntityTrait, QueryFilter, QueryOrder,
    QuerySelect, Set, sea_query::Expr,
};
use uuid::Uuid;

use super::budget_entity::{self, Entity as Budgets};
use super::expense_entity::{self, Entity as Expenses};
use super::period::Window;
use crate::error::AppError;

pub struct Repository {
    db: DatabaseConnection,
}

impl Repository {
    pub fn new(db: DatabaseConnection) -> Self {
        Self { db }
    }

    /* ─── Budgets ─── */

    pub async fn budgets(&self, user_id: &str) -> Result<Vec<budget_entity::Model>, AppError> {
        Ok(Budgets::find()
            .filter(budget_entity::Column::UserId.eq(user_id))
            .order_by_asc(budget_entity::Column::CreatedAt)
            .all(&self.db)
            .await?)
    }

    pub async fn budget(
        &self,
        user_id: &str,
        id: Uuid,
    ) -> Result<Option<budget_entity::Model>, AppError> {
        Ok(Budgets::find_by_id(id)
            .filter(budget_entity::Column::UserId.eq(user_id))
            .one(&self.db)
            .await?)
    }

    pub async fn insert_budget(
        &self,
        row: budget_entity::ActiveModel,
    ) -> Result<budget_entity::Model, AppError> {
        Ok(row.insert(&self.db).await?)
    }

    pub async fn update_budget(
        &self,
        mut row: budget_entity::ActiveModel,
    ) -> Result<budget_entity::Model, AppError> {
        row.updated_at = Set(Utc::now().fixed_offset());
        Ok(row.update(&self.db).await?)
    }

    pub async fn set_alerted_for(
        &self,
        existing: budget_entity::Model,
        alerted_for: Option<NaiveDate>,
    ) -> Result<(), AppError> {
        let mut row: budget_entity::ActiveModel = existing.into();
        row.alerted_for = Set(alerted_for);
        row.update(&self.db).await?;
        Ok(())
    }

    pub async fn delete_budget(&self, user_id: &str, id: Uuid) -> Result<bool, AppError> {
        let res = Budgets::delete_many()
            .filter(budget_entity::Column::Id.eq(id))
            .filter(budget_entity::Column::UserId.eq(user_id))
            .exec(&self.db)
            .await?;
        Ok(res.rows_affected > 0)
    }

    /* ─── Expenses ─── */

    pub async fn expenses_between(
        &self,
        user_id: &str,
        range: Window,
    ) -> Result<Vec<expense_entity::Model>, AppError> {
        Ok(Expenses::find()
            .filter(expense_entity::Column::UserId.eq(user_id))
            .filter(expense_entity::Column::SpentOn.between(range.start, range.end))
            .order_by_desc(expense_entity::Column::SpentOn)
            .order_by_desc(expense_entity::Column::CreatedAt)
            .all(&self.db)
            .await?)
    }

    /// Sum of a budget's expenses inside `window`. SUM(bigint) is numeric in Postgres, hence the cast.
    pub async fn spent_on_budget(
        &self,
        user_id: &str,
        budget_id: Uuid,
        window: Window,
    ) -> Result<i64, AppError> {
        let total: Option<i64> = Expenses::find()
            .select_only()
            .expr_as(
                Expr::cust("COALESCE(SUM(amount_cents), 0)::bigint"),
                "total",
            )
            .filter(expense_entity::Column::UserId.eq(user_id))
            .filter(expense_entity::Column::BudgetId.eq(budget_id))
            .filter(expense_entity::Column::SpentOn.between(window.start, window.end))
            .into_tuple()
            .one(&self.db)
            .await?;
        Ok(total.unwrap_or(0))
    }

    pub async fn expense(
        &self,
        user_id: &str,
        id: Uuid,
    ) -> Result<Option<expense_entity::Model>, AppError> {
        Ok(Expenses::find_by_id(id)
            .filter(expense_entity::Column::UserId.eq(user_id))
            .one(&self.db)
            .await?)
    }

    pub async fn insert_expense(
        &self,
        row: expense_entity::ActiveModel,
    ) -> Result<expense_entity::Model, AppError> {
        Ok(row.insert(&self.db).await?)
    }

    pub async fn update_expense(
        &self,
        mut row: expense_entity::ActiveModel,
    ) -> Result<expense_entity::Model, AppError> {
        row.updated_at = Set(Utc::now().fixed_offset());
        Ok(row.update(&self.db).await?)
    }

    pub async fn delete_expense(&self, user_id: &str, id: Uuid) -> Result<bool, AppError> {
        let res = Expenses::delete_many()
            .filter(expense_entity::Column::Id.eq(id))
            .filter(expense_entity::Column::UserId.eq(user_id))
            .exec(&self.db)
            .await?;
        Ok(res.rows_affected > 0)
    }
}
