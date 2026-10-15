//! SeaORM entity for `vault_keys`. Hand-written; keep in sync with migration
//! `m20261012_000009_create_vault` until entity generation is wired up.

use sea_orm::entity::prelude::*;

#[derive(Clone, Debug, PartialEq, Eq, DeriveEntityModel)]
#[sea_orm(table_name = "vault_keys")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub user_id: String,
    pub kdf: String,
    pub kdf_memory_kib: i32,
    pub kdf_iterations: i32,
    pub kdf_parallelism: i32,
    pub salt: Vec<u8>,
    pub wrapped_key: Vec<u8>,
    pub wrap_nonce: Vec<u8>,
    pub recovery_wrapped_key: Vec<u8>,
    pub recovery_nonce: Vec<u8>,
    pub created_at: DateTimeWithTimeZone,
    pub updated_at: DateTimeWithTimeZone,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {}

impl ActiveModelBehavior for ActiveModel {}
