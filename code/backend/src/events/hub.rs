//! In-process fan-out. One broadcast channel for the whole server; each open stream keeps only
//! its own user's events. Enough for one instance; Postgres LISTEN/NOTIFY when we scale out.

use serde::Serialize;
use tokio::sync::broadcast;
use uuid::Uuid;

use crate::http::extract::ClientId;

/// Events held for slow streams. A stream that falls further behind gets a `resync` instead.
const CAPACITY: usize = 256;

/// What changed. Serialized as the event's `type`, e.g. `"todo.created"`.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
pub enum Kind {
    #[serde(rename = "todo.created")]
    TodoCreated,
    #[serde(rename = "todo.updated")]
    TodoUpdated,
    #[serde(rename = "todo.deleted")]
    TodoDeleted,
    #[serde(rename = "note.created")]
    NoteCreated,
    #[serde(rename = "note.updated")]
    NoteUpdated,
    #[serde(rename = "note.deleted")]
    NoteDeleted,
    #[serde(rename = "shopping.created")]
    ShoppingCreated,
    #[serde(rename = "shopping.updated")]
    ShoppingUpdated,
    #[serde(rename = "shopping.deleted")]
    ShoppingDeleted,
    #[serde(rename = "budget.created")]
    BudgetCreated,
    #[serde(rename = "budget.updated")]
    BudgetUpdated,
    #[serde(rename = "budget.deleted")]
    BudgetDeleted,
    #[serde(rename = "expense.created")]
    ExpenseCreated,
    #[serde(rename = "expense.updated")]
    ExpenseUpdated,
    #[serde(rename = "expense.deleted")]
    ExpenseDeleted,
    #[serde(rename = "calendar.created")]
    CalendarCreated,
    #[serde(rename = "calendar.updated")]
    CalendarUpdated,
    #[serde(rename = "calendar.deleted")]
    CalendarDeleted,
    #[serde(rename = "vault.created")]
    VaultCreated,
    #[serde(rename = "vault.updated")]
    VaultUpdated,
    #[serde(rename = "vault.deleted")]
    VaultDeleted,
    #[serde(rename = "notification.created")]
    NotificationCreated,
    #[serde(rename = "notification.updated")]
    NotificationUpdated,
    #[serde(rename = "notification.deleted")]
    NotificationDeleted,
}

/// One change. Carries ids only: clients refetch, so no data can leak through the stream.
#[derive(Clone, Debug, Serialize)]
pub struct Event {
    /// Who may see it. Used for filtering, never sent.
    #[serde(skip)]
    pub user_id: String,
    #[serde(rename = "type")]
    pub kind: Kind,
    pub id: Uuid,
    /// The tab that made the change, so it can skip its own "changed elsewhere" toast.
    pub origin: Option<String>,
}

impl Event {
    pub fn new(user_id: &str, kind: Kind, id: Uuid, origin: ClientId) -> Self {
        Self {
            user_id: user_id.to_owned(),
            kind,
            id,
            origin: origin.0,
        }
    }
}

#[derive(Clone)]
pub struct Hub {
    tx: broadcast::Sender<Event>,
}

impl Hub {
    pub fn new() -> Self {
        let (tx, _) = broadcast::channel(CAPACITY);
        Self { tx }
    }

    /// Fire and forget: `send` only fails when no stream is open, which is fine.
    pub fn publish(&self, event: Event) {
        let _ = self.tx.send(event);
    }

    pub fn subscribe(&self) -> broadcast::Receiver<Event> {
        self.tx.subscribe()
    }
}

impl Default for Hub {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
#[allow(clippy::unwrap_used)] // tests may unwrap: a panic is a test failure
mod tests {
    use super::*;

    #[test]
    fn serializes_without_user_id() {
        let id = Uuid::nil();
        let event = Event::new(
            "user-1",
            Kind::TodoCreated,
            id,
            ClientId(Some("tab-1".into())),
        );
        let json = serde_json::to_value(&event).unwrap();
        assert_eq!(
            json,
            serde_json::json!({ "type": "todo.created", "id": id, "origin": "tab-1" })
        );
    }

    #[tokio::test]
    async fn subscribers_receive_published_events() {
        let hub = Hub::new();
        let mut rx = hub.subscribe();
        hub.publish(Event::new(
            "user-1",
            Kind::NoteDeleted,
            Uuid::nil(),
            ClientId(None),
        ));
        let got = rx.recv().await.unwrap();
        assert_eq!(got.kind, Kind::NoteDeleted);
        assert_eq!(got.user_id, "user-1");
    }
}
