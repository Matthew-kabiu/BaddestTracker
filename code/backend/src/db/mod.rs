//! Database connection. SeaORM's `DatabaseConnection` is already a pool.

use std::time::Duration;

use anyhow::Context;
use sea_orm::{ConnectOptions, Database, DatabaseConnection};
use secrecy::ExposeSecret;

use crate::config::Config;

pub async fn connect(config: &Config) -> anyhow::Result<DatabaseConnection> {
    let mut opt = ConnectOptions::new(config.database_url.expose_secret().to_owned());
    opt.max_connections(config.db_max_conns)
        .min_connections(1)
        .connect_timeout(Duration::from_secs(5))
        .acquire_timeout(Duration::from_secs(5))
        .idle_timeout(Duration::from_secs(600))
        .max_lifetime(Duration::from_secs(3600))
        .sqlx_logging(false);
    Database::connect(opt).await.context("connect database")
}
