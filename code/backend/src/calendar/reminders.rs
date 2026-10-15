//! Reminder worker (Rust template §16): every tick, send the reminders that have come due.
//! Runs inside the API process because live notifications fan out through its in-memory hub.

use std::{sync::Arc, time::Instant};

use chrono::{Duration, Utc};
use tokio::{
    sync::watch,
    time::{self, MissedTickBehavior},
};

use super::model::Occurrence;
use crate::{notification::NewNotification, state::AppState};

/// How often due reminders are checked.
const TICK: std::time::Duration = std::time::Duration::from_secs(30);
/// A cycle never outlives its tick (template §16.1 rule 1).
const CYCLE_TIMEOUT: std::time::Duration = std::time::Duration::from_secs(20);
/// Reminders missed while the server was down for up to this long are still sent.
const GRACE: Duration = Duration::minutes(10);

/// Run until `shutdown` changes. The first tick fires at once, so it also runs on startup.
pub async fn run(state: Arc<AppState>, mut shutdown: watch::Receiver<bool>) {
    let mut tick = time::interval(TICK);
    tick.set_missed_tick_behavior(MissedTickBehavior::Delay);
    loop {
        tokio::select! {
            _ = tick.tick() => run_cycle(&state).await,
            _ = shutdown.changed() => {
                tracing::info!("reminder worker stopping");
                return;
            }
        }
    }
}

async fn run_cycle(state: &AppState) {
    let started = Instant::now();
    let result = time::timeout(CYCLE_TIMEOUT, async {
        let due = match state.calendar.due_reminders(Utc::now(), GRACE).await {
            Ok(due) => due,
            Err(e) => {
                tracing::error!(error = ?e, "could not load due reminders");
                return 0;
            }
        };
        let mut sent = 0;
        // One at a time: bounded by construction, and reminders are few.
        for (user_id, occ) in due {
            // Claim first, so a reminder is sent at most once even if two cycles overlap.
            match state.calendar.claim_reminder(occ.event_id, occ.starts_at).await {
                Ok(true) => {}
                Ok(false) => continue,
                Err(e) => {
                    tracing::error!(error = ?e, event_id = %occ.event_id, "could not claim reminder");
                    continue;
                }
            }
            match state.notifications.notify(&user_id, reminder(&occ)).await {
                Ok(_) => sent += 1,
                Err(e) => tracing::error!(error = ?e, event_id = %occ.event_id, "reminder not sent"),
            }
        }
        sent
    })
    .await;
    match result {
        Ok(sent) if sent > 0 => tracing::info!(sent, "reminders sent"),
        Ok(_) => {}
        Err(_) => tracing::error!("reminder cycle timed out"),
    }
    tracing::debug!(
        duration_ms = started.elapsed().as_millis() as u64,
        "reminder cycle complete"
    );
}

fn reminder(occ: &Occurrence) -> NewNotification {
    let body = if occ.all_day {
        format!("All day on {}.", occ.start.format("%a %-d %b"))
    } else {
        format!(
            "Starts at {} on {}.",
            occ.start.format("%H:%M"),
            occ.start.format("%a %-d %b")
        )
    };
    NewNotification {
        kind: "calendar.reminder",
        title: format!("Reminder: {}", occ.title),
        body,
        link: Some("/dashboard/calendar"),
    }
}
