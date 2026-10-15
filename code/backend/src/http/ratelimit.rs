//! Per-client rate limit for the API (token bucket, in-process via tower_governor).
//! In-process state is enough for one instance; move to Redis only when we scale out.

use std::{
    net::{IpAddr, SocketAddr},
    sync::Arc,
    time::Duration,
};

use axum::{
    Router,
    body::Body,
    extract::ConnectInfo,
    http::{HeaderValue, Request, Response, header},
    response::IntoResponse,
};
use tower_governor::{
    GovernorError, GovernorLayer, governor::GovernorConfigBuilder, key_extractor::KeyExtractor,
};

use crate::error::AppError;

/// One request is refunded every 200 ms: 5 requests/second sustained per client.
const REFILL_EVERY: Duration = Duration::from_millis(200);
/// A client may fire this many at once (a dashboard load) before the refill rate applies.
const BURST: u32 = 50;
/// How often idle clients' buckets are dropped so memory does not grow without bound.
const CLEANUP_EVERY: Duration = Duration::from_secs(60);

/// Who is calling. Behind the Cloudflare Tunnel every request arrives from cloudflared, so the
/// peer address is the same for everyone. Cloudflare puts the real client in `CF-Connecting-IP`
/// and overwrites any value the client sent. Without that header (local dev) use the peer.
#[derive(Clone)]
pub struct ClientIp;

impl KeyExtractor for ClientIp {
    type Key = IpAddr;

    fn extract<T>(&self, req: &Request<T>) -> Result<Self::Key, GovernorError> {
        req.headers()
            .get("cf-connecting-ip")
            .and_then(|v| v.to_str().ok())
            .and_then(|v| v.trim().parse().ok())
            .or_else(|| {
                req.extensions()
                    .get::<ConnectInfo<SocketAddr>>()
                    .map(|c| c.0.ip())
            })
            .ok_or(GovernorError::UnableToExtractKey)
    }
}

/// Wrap `routes` in the limiter. Must be called inside the Tokio runtime (it spawns the cleanup).
pub fn limit<S: Clone + Send + Sync + 'static>(routes: Router<S>) -> Router<S> {
    // Startup only: `finish` returns None just for a zero period or burst, and both are
    // non-zero constants above.
    #[allow(clippy::expect_used)]
    let config = Arc::new(
        GovernorConfigBuilder::default()
            .period(REFILL_EVERY)
            .burst_size(BURST)
            .key_extractor(ClientIp)
            .finish()
            .expect("rate limit constants are non-zero"),
    );

    let limiter = config.limiter().clone();
    tokio::spawn(async move {
        let mut tick = tokio::time::interval(CLEANUP_EVERY);
        loop {
            tick.tick().await;
            limiter.retain_recent();
        }
    });

    routes.layer(GovernorLayer::new(config).error_handler(rejection))
}

/// Same JSON envelope as every other error, plus `Retry-After` so clients know when to retry.
/// The wait is whole seconds and a refill takes 200 ms, so it is floored at 1 rather than 0.
fn rejection(err: GovernorError) -> Response<Body> {
    match err {
        GovernorError::TooManyRequests { wait_time, .. } => {
            let mut resp = AppError::RateLimited.into_response();
            resp.headers_mut()
                .insert(header::RETRY_AFTER, HeaderValue::from(wait_time.max(1)));
            resp
        }
        other => AppError::Internal(anyhow::anyhow!("rate limiter: {other}")).into_response(),
    }
}

#[cfg(test)]
#[allow(clippy::unwrap_used)] // tests may unwrap: a panic is a test failure
mod tests {
    use super::*;

    fn request(cf: Option<&str>, peer: Option<&str>) -> Request<()> {
        let mut req = Request::new(());
        if let Some(ip) = cf {
            req.headers_mut()
                .insert("cf-connecting-ip", HeaderValue::from_str(ip).unwrap());
        }
        if let Some(addr) = peer {
            req.extensions_mut()
                .insert(ConnectInfo::<SocketAddr>(addr.parse().unwrap()));
        }
        req
    }

    #[test]
    fn cloudflare_header_wins_over_peer() {
        let ip = ClientIp
            .extract(&request(Some("203.0.113.7"), Some("172.18.0.5:41000")))
            .unwrap();
        assert_eq!(ip, "203.0.113.7".parse::<IpAddr>().unwrap());
    }

    #[test]
    fn falls_back_to_peer_without_header() {
        let ip = ClientIp
            .extract(&request(None, Some("127.0.0.1:41000")))
            .unwrap();
        assert_eq!(ip, "127.0.0.1".parse::<IpAddr>().unwrap());
    }

    #[test]
    fn garbage_header_falls_back_to_peer() {
        let ip = ClientIp
            .extract(&request(Some("not-an-ip"), Some("127.0.0.1:41000")))
            .unwrap();
        assert_eq!(ip, "127.0.0.1".parse::<IpAddr>().unwrap());
    }

    #[test]
    fn no_header_and_no_peer_is_an_error() {
        assert!(ClientIp.extract(&request(None, None)).is_err());
    }
}
