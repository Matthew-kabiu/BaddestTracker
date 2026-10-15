//! Entrypoint: wiring only. Build config, logging, DB, state, router — then serve.

use std::sync::Arc;

use anyhow::Context;
use baddest_backend::{
    budget, calendar, config::Config, crypto::KeyCipher, db, events, http, note, notification,
    shopping, state::AppState, telegram, todo, vault,
};
use migration::{Migrator, MigratorTrait};
use tokio::io::{AsyncReadExt, AsyncWriteExt};

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // `--health` lets the distroless image (no shell, no curl) run its own healthcheck.
    if std::env::args().any(|a| a == "--health") {
        return health_probe().await;
    }

    let config = Config::load()?;
    init_tracing(&config);
    tracing::info!(env = %config.app_env, "starting");

    let db = db::connect(&config).await?;
    Migrator::up(&db, None).await.context("run migrations")?;

    let port = config.backend_port;
    let http = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(60))
        .redirect(reqwest::redirect::Policy::none())
        .build()
        .context("build http client")?;
    let todos = todo::service(db.clone());
    let notes = note::service(db.clone());
    // Shared: the budget service reads shopping spend too.
    let shopping = Arc::new(shopping::service(db.clone()));
    let events = events::Hub::new();
    // Shared: other modules (budget alerts, reminders) raise notifications through it.
    let cipher = KeyCipher::from_base64(&config.ai_keys_encryption_key)
        .map_err(|e| anyhow::anyhow!("{e}"))?;
    let telegram = Arc::new(telegram::service(db.clone(), http.clone(), cipher));
    let notifications = Arc::new(notification::service(
        db.clone(),
        events.clone(),
        telegram.clone(),
    ));
    let budgets = budget::service(db.clone(), shopping.clone(), notifications.clone());
    let calendar = calendar::service(db.clone());
    let vault = vault::service(db.clone());
    let state = Arc::new(AppState {
        config,
        db,
        http,
        todos,
        notes,
        shopping,
        notifications,
        budgets,
        calendar,
        telegram,
        vault,
        events,
    });

    // Background reminder worker; stopped after the server has drained.
    let (stop_worker, worker_stop) = tokio::sync::watch::channel(false);
    let worker = tokio::spawn(calendar::reminders::run(state.clone(), worker_stop));
    let served = http::serve(http::router(state), port).await;
    let _ = stop_worker.send(true);
    if let Err(e) = worker.await {
        tracing::error!(error = ?e, "reminder worker crashed");
    }
    served
}

fn init_tracing(config: &Config) {
    use tracing_subscriber::EnvFilter;
    // Config::validate has already proven LOG_LEVEL parses, so this cannot fail here.
    let filter = EnvFilter::new(&config.log_level);
    let builder = tracing_subscriber::fmt().with_env_filter(filter);
    if config.is_production() {
        builder.json().init();
    } else {
        builder.pretty().init();
    }
}

/// Minimal HTTP/1.0 GET to our own health endpoint; exit code is the healthcheck result.
async fn health_probe() -> anyhow::Result<()> {
    let port = std::env::var("BACKEND_PORT").context("BACKEND_PORT is not set")?;
    let mut stream = tokio::net::TcpStream::connect(format!("127.0.0.1:{port}")).await?;
    stream
        .write_all(b"GET /api/health HTTP/1.0\r\nHost: localhost\r\n\r\n")
        .await?;
    let mut buf = [0u8; 16];
    let n = stream.read(&mut buf).await?;
    let status_line = String::from_utf8_lossy(&buf[..n]);
    if status_line.contains(" 200") {
        Ok(())
    } else {
        anyhow::bail!("unhealthy: {status_line}")
    }
}
