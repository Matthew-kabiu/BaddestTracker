//! Domain type and request DTOs. JSON is camelCase to match the frontend.

use chrono::{DateTime, FixedOffset};
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use validator::Validate;

use super::entity;

/// What the API returns. Never includes `user_id` — the caller already knows who they are.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Todo {
    pub id: Uuid,
    pub title: String,
    pub done: bool,
    pub created_at: DateTime<FixedOffset>,
    pub updated_at: DateTime<FixedOffset>,
}

impl From<entity::Model> for Todo {
    fn from(m: entity::Model) -> Self {
        Self {
            id: m.id,
            title: m.title,
            done: m.done,
            created_at: m.created_at,
            updated_at: m.updated_at,
        }
    }
}

#[derive(Debug, Deserialize, Validate)]
#[serde(deny_unknown_fields)]
pub struct CreateTodo {
    #[validate(length(min = 1, max = 500))]
    pub title: String,
}

/// PATCH body: every field optional; only the ones sent are changed.
#[derive(Debug, Deserialize, Validate)]
#[serde(deny_unknown_fields)]
pub struct UpdateTodo {
    #[validate(length(min = 1, max = 500))]
    pub title: Option<String>,
    pub done: Option<bool>,
}
