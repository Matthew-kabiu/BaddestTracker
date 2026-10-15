//! `cargo run -p migration -- up|down|status|fresh` — the sea-orm-cli entrypoint.

use sea_orm_migration::prelude::*;

#[tokio::main]
async fn main() {
    cli::run_cli(migration::Migrator).await;
}
