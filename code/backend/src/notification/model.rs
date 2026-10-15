//! Domain types and request DTOs. JSON is camelCase to match the frontend.

use chrono::{DateTime, FixedOffset};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use super::entity;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Notification {
    pub id: Uuid,
    /// Machine-readable source, e.g. `budget.exceeded`. The UI picks an icon from it.
    pub kind: String,
    pub title: String,
    pub body: String,
    pub link: Option<String>,
    pub read_at: Option<DateTime<FixedOffset>>,
    pub created_at: DateTime<FixedOffset>,
}

impl From<entity::Model> for Notification {
    fn from(m: entity::Model) -> Self {
        Self {
            id: m.id,
            kind: m.kind,
            title: m.title,
            body: m.body,
            link: m.link,
            read_at: m.read_at,
            created_at: m.created_at,
        }
    }
}

/// GET response: the latest notifications plus the total unread (which may be more).
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Inbox {
    pub items: Vec<Notification>,
    pub unread_count: u64,
}

/// What a module passes to `Service::notify`. Written by our code, never by a request body.
pub struct NewNotification {
    pub kind: &'static str,
    pub title: String,
    pub body: String,
    pub link: Option<&'static str>,
}

#[derive(Debug, Deserialize, validator::Validate)]
#[serde(deny_unknown_fields)]
pub struct UpdateNotification {
    pub read: bool,
}
