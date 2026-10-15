//! GET /api/v1/events: the signed-in user's live event stream.

use std::{convert::Infallible, sync::Arc, time::Duration};

use axum::{
    extract::State,
    response::sse::{Event as SseEvent, KeepAlive, Sse},
};
use tokio_stream::{
    Stream, StreamExt,
    wrappers::{BroadcastStream, errors::BroadcastStreamRecvError},
};

use crate::{auth::AuthUser, state::AppState};

/// A comment line this often keeps idle connections open through Cloudflare (100 s idle cut).
const KEEP_ALIVE: Duration = Duration::from_secs(20);

/// The session is checked once, when the stream opens. The browser's EventSource reconnects
/// on its own after a drop, and each reconnect is checked again.
pub async fn stream(
    State(state): State<Arc<AppState>>,
    user: AuthUser,
) -> Sse<impl Stream<Item = Result<SseEvent, Infallible>>> {
    let events = BroadcastStream::new(state.events.subscribe()).filter_map(move |msg| match msg {
        Ok(event) if event.user_id == user.id => SseEvent::default().json_data(&event).ok(),
        Ok(_) => None,
        // This stream fell behind and missed events: tell the client to refetch everything.
        Err(BroadcastStreamRecvError::Lagged(_)) => {
            Some(SseEvent::default().data(r#"{"type":"resync"}"#))
        }
    });
    Sse::new(events.map(Ok)).keep_alive(KeepAlive::new().interval(KEEP_ALIVE))
}
