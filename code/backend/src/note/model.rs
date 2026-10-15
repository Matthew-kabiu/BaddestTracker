//! Domain type and request DTOs. JSON is camelCase to match the frontend.

use chrono::{DateTime, FixedOffset};
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use validator::Validate;

use super::entity;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Note {
    pub id: Uuid,
    pub title: String,
    pub body: String,
    pub created_at: DateTime<FixedOffset>,
    pub updated_at: DateTime<FixedOffset>,
}

impl From<entity::Model> for Note {
    fn from(m: entity::Model) -> Self {
        Self {
            id: m.id,
            title: m.title,
            body: m.body,
            created_at: m.created_at,
            updated_at: m.updated_at,
        }
    }
}

#[derive(Debug, Deserialize, Validate)]
#[serde(deny_unknown_fields)]
pub struct CreateNote {
    #[validate(length(min = 1, max = 300))]
    pub title: String,
    #[validate(length(max = 100000))]
    pub body: String,
}

#[derive(Debug, Deserialize, Validate)]
#[serde(deny_unknown_fields)]
pub struct UpdateNote {
    #[validate(length(min = 1, max = 300))]
    pub title: Option<String>,
    #[validate(length(max = 100000))]
    pub body: Option<String>,
}
