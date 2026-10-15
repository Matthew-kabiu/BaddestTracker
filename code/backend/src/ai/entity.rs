//! SeaORM entity for `ai_provider_keys`.
//! Hand-written for v1; replace with `sea-orm-cli generate entity` output once entity
//! generation is wired up (Rust template §12.1). Keep in sync with migration
//! `m20261012_000002_create_ai_provider_keys`.

use sea_orm::entity::prelude::*;

#[derive(Clone, Debug, PartialEq, Eq, DeriveEntityModel)]
#[sea_orm(table_name = "ai_provider_keys")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub id: Uuid,
    pub user_id: String,
    pub provider: String,
    pub model: String,
    pub ciphertext: Vec<u8>,
    pub nonce: Vec<u8>,
    pub created_at: DateTimeWithTimeZone,
    pub updated_at: DateTimeWithTimeZone,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {}

impl ActiveModelBehavior for ActiveModel {}
