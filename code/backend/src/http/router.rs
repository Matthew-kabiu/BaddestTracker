//! The route table. The full API surface lives here so it can be read at once.

use std::{sync::Arc, time::Duration};

use axum::{
    Router,
    extract::DefaultBodyLimit,
    http::{HeaderName, HeaderValue, Method, StatusCode, header},
    routing::get,
};
use tower::ServiceBuilder;
use tower_http::{
    catch_panic::CatchPanicLayer,
    cors::{AllowOrigin, CorsLayer},
    request_id::{MakeRequestUuid, PropagateRequestIdLayer, SetRequestIdLayer},
    set_header::SetResponseHeaderLayer,
    timeout::TimeoutLayer,
    trace::TraceLayer,
};

use super::ratelimit;
use crate::{config::Config, health, state::AppState};

const BODY_LIMIT_BYTES: usize = 1 << 20;
const REQUEST_TIMEOUT: Duration = Duration::from_secs(30);

pub fn router(state: Arc<AppState>) -> Router {
    // Rate-limited per client. Health stays outside so Docker's healthcheck is never throttled.
    let api = ratelimit::limit(
        Router::new()
            .nest("/ai", crate::ai::routes())
            .nest("/todos", crate::todo::routes())
            .nest("/notes", crate::note::routes())
            .nest("/shopping", crate::shopping::routes())
            .nest("/notifications", crate::notification::routes())
            .nest("/budgets", crate::budget::routes())
            .nest("/expenses", crate::budget::expense_routes())
            .nest("/calendar", crate::calendar::routes())
            .nest("/telegram", crate::telegram::routes())
            .nest("/vault", crate::vault::routes())
            .nest("/events", crate::events::routes()),
    );

    Router::new()
        .route("/api/health", get(health::handler::check))
        .nest("/api/v1", api)
        .layer(
            // First listed = outermost: request ID exists before tracing starts its span.
            ServiceBuilder::new()
                .layer(SetRequestIdLayer::x_request_id(MakeRequestUuid))
                .layer(PropagateRequestIdLayer::x_request_id())
                .layer(TraceLayer::new_for_http())
                .layer(CatchPanicLayer::new())
                .layer(TimeoutLayer::with_status_code(
                    StatusCode::REQUEST_TIMEOUT,
                    REQUEST_TIMEOUT,
                ))
                .layer(header("x-content-type-options", "nosniff"))
                .layer(header("x-frame-options", "DENY"))
                .layer(header("referrer-policy", "strict-origin-when-cross-origin"))
                .layer(header(
                    "strict-transport-security",
                    "max-age=31536000; includeSubDomains",
                ))
                .layer(header(
                    "permissions-policy",
                    "camera=(), microphone=(), geolocation=()",
                ))
                .layer(cors(&state.config))
                .layer(DefaultBodyLimit::max(BODY_LIMIT_BYTES)),
        )
        .with_state(state)
}

fn header(name: &'static str, value: &'static str) -> SetResponseHeaderLayer<HeaderValue> {
    SetResponseHeaderLayer::overriding(
        HeaderName::from_static(name),
        HeaderValue::from_static(value),
    )
}

fn cors(config: &Config) -> CorsLayer {
    // Config::validate already rejected "*"; unparseable origins are skipped, not trusted.
    let origins: Vec<HeaderValue> = config
        .cors_origins
        .iter()
        .filter_map(|o| HeaderValue::from_str(o).ok())
        .collect();
    CorsLayer::new()
        .allow_origin(AllowOrigin::list(origins))
        .allow_credentials(true)
        .allow_methods([
            Method::GET,
            Method::POST,
            Method::PUT,
            Method::PATCH,
            Method::DELETE,
        ])
        .allow_headers([header::CONTENT_TYPE, HeaderName::from_static("x-client-id")])
}
