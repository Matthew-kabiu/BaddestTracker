//! Schema migrations. One file per change; never edit a merged migration — add a new one.

pub use sea_orm_migration::prelude::*;

mod m20261012_000002_create_ai_provider_keys;
mod m20261012_000003_create_todos_and_notes;
mod m20261012_000004_create_shopping_items;
mod m20261012_000005_create_notifications;
mod m20261012_000006_create_budgets_and_expenses;
mod m20261012_000007_create_events;
mod m20261012_000008_create_telegram_links;
mod m20261012_000009_create_vault;

pub struct Migrator;

#[async_trait::async_trait]
impl MigratorTrait for Migrator {
    fn migrations() -> Vec<Box<dyn MigrationTrait>> {
        // Users/sessions are owned by the Better Auth service, not these migrations.
        vec![
            Box::new(m20261012_000002_create_ai_provider_keys::Migration),
            Box::new(m20261012_000003_create_todos_and_notes::Migration),
            Box::new(m20261012_000004_create_shopping_items::Migration),
            Box::new(m20261012_000005_create_notifications::Migration),
            Box::new(m20261012_000006_create_budgets_and_expenses::Migration),
            Box::new(m20261012_000007_create_events::Migration),
            Box::new(m20261012_000008_create_telegram_links::Migration),
            Box::new(m20261012_000009_create_vault::Migration),
        ]
    }
}
