//! SeaORM entity for `expenses`. Hand-written; keep in sync with migration
//! `m20261012_000006_create_budgets_and_expenses` until entity generation is wired up.

use sea_orm::entity::prelude::*;

#[derive(Clone, Debug, PartialEq, Eq, DeriveEntityModel)]
#[sea_orm(table_name = "expenses")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub id: Uuid,
    pub user_id: String,
    pub budget_id: Option<Uuid>,
    pub amount_cents: i64,
    pub description: String,
    pub spent_on: Date,
    pub created_at: DateTimeWithTimeZone,
    pub updated_at: DateTimeWithTimeZone,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {}

impl ActiveModelBehavior for ActiveModel {}
