//! Domain types and request DTOs. JSON is camelCase to match the frontend.
//! Local times are wall-clock times in the event's `timezone`, e.g. "2026-10-12T09:00:00".

use chrono::{DateTime, FixedOffset, NaiveDate, NaiveDateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use validator::Validate;

use super::entity;
use super::recurrence::{Freq, Repeat};
use crate::http::nullable;

/// Four weeks: the longest reminder lead time offered.
pub const MAX_REMINDER_MINUTES: i32 = 40_320;

#[derive(Clone, Copy, Debug, Serialize, Deserialize, Validate)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
pub struct RepeatDto {
    pub freq: Freq,
    #[validate(range(min = 1, max = 365))]
    pub interval: u32,
    /// Last day an occurrence may start (inclusive). At most one of `until` / `count`.
    pub until: Option<NaiveDate>,
    #[validate(range(min = 1, max = 1000))]
    pub count: Option<u32>,
}

impl From<RepeatDto> for Repeat {
    fn from(r: RepeatDto) -> Self {
        Self {
            freq: r.freq,
            interval: r.interval,
            until: r.until,
            count: r.count,
        }
    }
}

/// An event series as stored. Returned by create/update.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Event {
    pub id: Uuid,
    pub title: String,
    pub notes: String,
    pub all_day: bool,
    pub start: NaiveDateTime,
    pub end: NaiveDateTime,
    pub timezone: String,
    pub repeat: Option<RepeatDto>,
    pub reminder_minutes: Option<i32>,
    pub created_at: DateTime<FixedOffset>,
    pub updated_at: DateTime<FixedOffset>,
}

impl Event {
    /// None if the stored repeat frequency is unknown (a corrupt row).
    pub fn from_row(m: entity::Model) -> Option<Self> {
        let repeat = match m.repeat_freq.as_deref() {
            None => None,
            Some(f) => Some(RepeatDto {
                freq: Freq::parse(f)?,
                interval: u32::try_from(m.repeat_interval).ok()?,
                until: m.repeat_until,
                count: m.repeat_count.and_then(|c| u32::try_from(c).ok()),
            }),
        };
        Some(Self {
            id: m.id,
            title: m.title,
            notes: m.notes,
            all_day: m.all_day,
            start: m.start_local,
            end: m.end_local,
            timezone: m.timezone,
            repeat,
            reminder_minutes: m.reminder_minutes,
            created_at: m.created_at,
            updated_at: m.updated_at,
        })
    }
}

/// One concrete occurrence of a series, for the calendar views.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Occurrence {
    pub event_id: Uuid,
    pub title: String,
    pub notes: String,
    pub all_day: bool,
    /// Wall-clock times in `timezone` (for display).
    pub start: NaiveDateTime,
    pub end: NaiveDateTime,
    /// The same moments as instants (for sorting and "now" comparisons).
    pub starts_at: DateTime<Utc>,
    pub ends_at: DateTime<Utc>,
    pub timezone: String,
    pub repeats: bool,
    pub reminder_minutes: Option<i32>,
}

#[derive(Debug, Deserialize, Validate)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
pub struct CreateEvent {
    #[validate(length(min = 1, max = 200))]
    pub title: String,
    #[validate(length(max = 5000))]
    #[serde(default)]
    pub notes: String,
    pub all_day: bool,
    pub start: NaiveDateTime,
    pub end: NaiveDateTime,
    /// IANA zone, e.g. "Africa/Nairobi" (the browser's `Intl` zone).
    #[validate(length(min = 1, max = 64))]
    pub timezone: String,
    #[validate(nested)]
    pub repeat: Option<RepeatDto>,
    #[validate(range(min = 0, max = MAX_REMINDER_MINUTES))]
    pub reminder_minutes: Option<i32>,
}

/// PATCH body. For the nullable fields, absent = leave alone, `null` = clear. Edits apply to the
/// whole series.
#[derive(Debug, Deserialize, Validate)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
pub struct UpdateEvent {
    #[validate(length(min = 1, max = 200))]
    pub title: Option<String>,
    #[validate(length(max = 5000))]
    pub notes: Option<String>,
    pub all_day: Option<bool>,
    pub start: Option<NaiveDateTime>,
    pub end: Option<NaiveDateTime>,
    #[validate(length(min = 1, max = 64))]
    pub timezone: Option<String>,
    #[serde(default, deserialize_with = "nullable::deserialize")]
    #[validate(nested)]
    pub repeat: Option<Option<RepeatDto>>,
    #[serde(default, deserialize_with = "nullable::deserialize")]
    #[validate(range(min = 0, max = MAX_REMINDER_MINUTES))]
    pub reminder_minutes: Option<Option<i32>>,
}

/// `?from=YYYY-MM-DD&to=YYYY-MM-DD`, inclusive days.
#[derive(Debug, Deserialize)]
pub struct RangeQuery {
    pub from: NaiveDate,
    pub to: NaiveDate,
}
