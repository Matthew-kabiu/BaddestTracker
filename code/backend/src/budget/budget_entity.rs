//! SeaORM entity for `budgets`. Hand-written; keep in sync with migration
//! `m20261012_000006_create_budgets_and_expenses` until entity generation is wired up.

use sea_orm::entity::prelude::*;

#[derive(Clone, Debug, PartialEq, Eq, DeriveEntityModel)]
#[sea_orm(table_name = "budgets")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub id: Uuid,
    pub user_id: String,
    pub name: String,
    pub amount_cents: i64,
    pub period: String,
    pub custom_start: Option<Date>,
    pub custom_end: Option<Date>,
    pub includes_shopping: bool,
    pub alerted_for: Option<Date>,
    pub created_at: DateTimeWithTimeZone,
    pub updated_at: DateTimeWithTimeZone,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {}

impl ActiveModelBehavior for ActiveModel {}
