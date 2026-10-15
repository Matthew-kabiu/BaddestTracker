//! Transport plumbing: routing, response envelope, serving. No business logic.

pub mod extract;
pub mod nullable;
mod ratelimit;
pub mod respond;
mod router;

pub use router::router;

use std::net::SocketAddr;

use anyhow::Context;
use axum::Router;

/// Bind, serve, and drain in-flight requests on SIGINT/SIGTERM.
pub async fn serve(app: Router, port: u16) -> anyhow::Result<()> {
    let listener = tokio::net::TcpListener::bind(("0.0.0.0", port))
        .await
        .with_context(|| format!("bind port {port}"))?;
    tracing::info!(port, "listening");
    // Connect info gives the rate limiter the peer address when no proxy header is present.
    axum::serve(
        listener,
        app.into_make_service_with_connect_info::<SocketAddr>(),
    )
    .with_graceful_shutdown(shutdown_signal())
    .await
    .context("serve")
}

async fn shutdown_signal() {
    // If a handler can't be installed, log it and wait forever on that branch so the
    // other signal still works — never crash the server over shutdown plumbing.
    let ctrl_c = async {
        if let Err(e) = tokio::signal::ctrl_c().await {
            tracing::error!(error = ?e, "could not listen for Ctrl+C");
            std::future::pending::<()>().await;
        }
    };
    #[cfg(unix)]
    let terminate = async {
        match tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate()) {
            Ok(mut sig) => {
                sig.recv().await;
            }
            Err(e) => {
                tracing::error!(error = ?e, "could not listen for SIGTERM");
                std::future::pending::<()>().await;
            }
        }
    };
    #[cfg(not(unix))]
    let terminate = std::future::pending::<()>();

    tokio::select! {
        _ = ctrl_c => {},
        _ = terminate => {},
    }
    tracing::info!("shutdown signal received");
}
