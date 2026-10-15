//! SeaORM entity for `events`. Hand-written; keep in sync with migration
//! `m20261012_000007_create_events` until entity generation is wired up.

use sea_orm::entity::prelude::*;

#[derive(Clone, Debug, PartialEq, Eq, DeriveEntityModel)]
#[sea_orm(table_name = "events")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub id: Uuid,
    pub user_id: String,
    pub title: String,
    pub notes: String,
    pub all_day: bool,
    pub start_local: DateTime,
    pub end_local: DateTime,
    pub timezone: String,
    pub repeat_freq: Option<String>,
    pub repeat_interval: i32,
    pub repeat_until: Option<Date>,
    pub repeat_count: Option<i32>,
    pub reminder_minutes: Option<i32>,
    pub created_at: DateTimeWithTimeZone,
    pub updated_at: DateTimeWithTimeZone,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {}

impl ActiveModelBehavior for ActiveModel {}
