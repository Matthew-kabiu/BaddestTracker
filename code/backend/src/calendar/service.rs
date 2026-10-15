//! Calendar business logic: validation, expanding series into occurrences, finding due
//! reminders. Knows nothing about HTTP.

use chrono::{DateTime, Duration, NaiveDate, NaiveDateTime, NaiveTime, Utc};
use chrono_tz::Tz;
use sea_orm::Set;
use uuid::Uuid;

use super::entity;
use super::model::{CreateEvent, Event, Occurrence, RepeatDto, UpdateEvent};
use super::recurrence::{self, Repeat};
use super::repository::Repository;
use crate::error::AppError;

/// Widest range one request may ask for.
const MAX_RANGE_DAYS: i64 = 400;
/// Most occurrences one request returns (all series together).
const MAX_OCCURRENCES: usize = 2000;
/// Longest single event.
const MAX_EVENT_DAYS: i64 = 366;
/// Extra local-time margin when turning an instant window into local times (DST shifts).
const DST_SLACK: Duration = Duration::hours(2);

pub struct Service {
    repo: Repository,
}

impl Service {
    pub fn new(repo: Repository) -> Self {
        Self { repo }
    }

    /// Every occurrence overlapping the days `from..=to`, sorted by start, capped.
    pub async fn occurrences(
        &self,
        user_id: &str,
        from: NaiveDate,
        to: NaiveDate,
    ) -> Result<Vec<Occurrence>, AppError> {
        if from > to || (to - from).num_days() > MAX_RANGE_DAYS {
            return Err(AppError::Validation(
                "from must be on or before to, at most 400 days apart".into(),
            ));
        }
        let start = from.and_time(NaiveTime::MIN);
        let end = to.and_hms_opt(23, 59, 59).unwrap_or(start);
        let mut out = Vec::new();
        for row in self.repo.list(user_id).await? {
            let event = parse(row)?;
            out.extend(expand(&event, start, end, MAX_OCCURRENCES)?);
        }
        out.sort_by_key(|o| o.starts_at);
        out.truncate(MAX_OCCURRENCES);
        Ok(out)
    }

    pub async fn get(&self, user_id: &str, id: Uuid) -> Result<Event, AppError> {
        parse(self.find(user_id, id).await?)
    }

    pub async fn create(&self, user_id: &str, input: CreateEvent) -> Result<Event, AppError> {
        let repeat = input.repeat;
        check(
            input.all_day,
            input.start,
            input.end,
            &input.timezone,
            repeat.as_ref(),
        )?;
        // New events cannot start on a past day (today in the event's own zone is fine).
        // Edits are not limited: a series that began last month is still edited.
        let today = Utc::now()
            .with_timezone(&zone(&input.timezone)?)
            .date_naive();
        if input.start.date() < today {
            return Err(AppError::Validation(
                "an event cannot start on a past day".into(),
            ));
        }
        let now = Utc::now().fixed_offset();
        let mut row = entity::ActiveModel {
            id: Set(Uuid::new_v4()),
            user_id: Set(user_id.to_owned()),
            title: Set(input.title.trim().to_owned()),
            notes: Set(input.notes),
            all_day: Set(input.all_day),
            start_local: Set(input.start),
            end_local: Set(input.end),
            timezone: Set(input.timezone),
            reminder_minutes: Set(input.reminder_minutes),
            created_at: Set(now),
            updated_at: Set(now),
            ..Default::default()
        };
        set_repeat(&mut row, repeat);
        parse(self.repo.insert(row).await?)
    }

    pub async fn update(
        &self,
        user_id: &str,
        id: Uuid,
        input: UpdateEvent,
    ) -> Result<Event, AppError> {
        let existing = self.find(user_id, id).await?;
        let current = parse(existing.clone())?;
        // Validate the event as it will be after the change, not the patch on its own.
        let all_day = input.all_day.unwrap_or(current.all_day);
        let start = input.start.unwrap_or(current.start);
        let end = input.end.unwrap_or(current.end);
        let timezone = input.timezone.unwrap_or(current.timezone);
        let repeat = input.repeat.unwrap_or(current.repeat);
        check(all_day, start, end, &timezone, repeat.as_ref())?;

        let mut row: entity::ActiveModel = existing.into();
        if let Some(v) = input.title {
            row.title = Set(v.trim().to_owned());
        }
        if let Some(v) = input.notes {
            row.notes = Set(v);
        }
        if let Some(v) = input.reminder_minutes {
            row.reminder_minutes = Set(v);
        }
        row.all_day = Set(all_day);
        row.start_local = Set(start);
        row.end_local = Set(end);
        row.timezone = Set(timezone);
        set_repeat(&mut row, repeat);
        parse(self.repo.update(row).await?)
    }

    pub async fn delete(&self, user_id: &str, id: Uuid) -> Result<(), AppError> {
        if self.repo.delete(user_id, id).await? {
            Ok(())
        } else {
            Err(AppError::NotFound("event"))
        }
    }

    /* ─── Reminders (worker) ─── */

    /// Occurrences whose reminder time falls in `(now - grace, now]`, with their owner.
    /// The grace lets a restarted server catch up on reminders it missed while down.
    pub async fn due_reminders(
        &self,
        now: DateTime<Utc>,
        grace: Duration,
    ) -> Result<Vec<(String, Occurrence)>, AppError> {
        let mut due = Vec::new();
        for row in self.repo.with_reminders().await? {
            let user_id = row.user_id.clone();
            let event = parse(row)?;
            let Some(minutes) = event.reminder_minutes else {
                continue;
            };
            let lead = Duration::minutes(i64::from(minutes));
            // Reminder at `start - lead`, so the starts we want are in (now - grace + lead, now + lead].
            let (lo, hi) = (now - grace + lead, now + lead);
            let tz = zone(&event.timezone)?;
            let local_lo = lo.with_timezone(&tz).naive_local() - DST_SLACK;
            let local_hi = hi.with_timezone(&tz).naive_local() + DST_SLACK;
            for occ in expand(&event, local_lo, local_hi, 50)? {
                if occ.starts_at > lo && occ.starts_at <= hi {
                    due.push((user_id.clone(), occ));
                }
            }
        }
        Ok(due)
    }

    pub async fn claim_reminder(
        &self,
        event_id: Uuid,
        starts_at: DateTime<Utc>,
    ) -> Result<bool, AppError> {
        self.repo.claim_reminder(event_id, starts_at).await
    }

    async fn find(&self, user_id: &str, id: Uuid) -> Result<entity::Model, AppError> {
        // Someone else's event is reported as not found, so its existence never leaks.
        self.repo
            .find(user_id, id)
            .await?
            .ok_or(AppError::NotFound("event"))
    }
}

/// Occurrences of `event` overlapping the local range `[from, to]`.
fn expand(
    event: &Event,
    from: NaiveDateTime,
    to: NaiveDateTime,
    limit: usize,
) -> Result<Vec<Occurrence>, AppError> {
    let tz = zone(&event.timezone)?;
    let length = event.end - event.start;
    // An all-day event covers its last day too: it ends at the next midnight.
    let span = if event.all_day {
        length + Duration::days(1)
    } else {
        length
    };
    let repeat: Option<Repeat> = event.repeat.map(Repeat::from);
    // Starts up to `span` before `from` still overlap it.
    let starts = recurrence::starts_between(event.start, repeat.as_ref(), from - span, to, limit);
    Ok(starts
        .into_iter()
        .map(|start| Occurrence {
            event_id: event.id,
            title: event.title.clone(),
            notes: event.notes.clone(),
            all_day: event.all_day,
            start,
            end: start + length,
            starts_at: recurrence::to_utc(start, tz),
            ends_at: recurrence::to_utc(start + span, tz),
            timezone: event.timezone.clone(),
            repeats: event.repeat.is_some(),
            reminder_minutes: event.reminder_minutes,
        })
        .collect())
}

fn zone(name: &str) -> Result<Tz, AppError> {
    name.parse()
        .map_err(|_| AppError::Validation(format!("unknown time zone: {name}")))
}

fn parse(row: entity::Model) -> Result<Event, AppError> {
    let id = row.id;
    Event::from_row(row)
        .ok_or_else(|| AppError::Internal(anyhow::anyhow!("event {id} has an invalid repeat rule")))
}

fn set_repeat(row: &mut entity::ActiveModel, repeat: Option<RepeatDto>) {
    row.repeat_freq = Set(repeat.map(|r| r.freq.as_str().to_owned()));
    row.repeat_interval = Set(repeat.map_or(1, |r| i32::try_from(r.interval).unwrap_or(1)));
    row.repeat_until = Set(repeat.and_then(|r| r.until));
    row.repeat_count = Set(repeat
        .and_then(|r| r.count)
        .and_then(|c| i32::try_from(c).ok()));
}

/// The rules every stored event satisfies.
fn check(
    all_day: bool,
    start: NaiveDateTime,
    end: NaiveDateTime,
    timezone: &str,
    repeat: Option<&RepeatDto>,
) -> Result<(), AppError> {
    zone(timezone)?;
    if end < start {
        return Err(AppError::Validation("end must not be before start".into()));
    }
    if (end - start).num_days() > MAX_EVENT_DAYS {
        return Err(AppError::Validation(
            "an event can last at most a year".into(),
        ));
    }
    if all_day && (start.time() != NaiveTime::MIN || end.time() != NaiveTime::MIN) {
        return Err(AppError::Validation(
            "all-day events start and end at 00:00 (dates only)".into(),
        ));
    }
    if let Some(r) = repeat {
        if r.until.is_some() && r.count.is_some() {
            return Err(AppError::Validation(
                "a repeat ends on a date or after a count, not both".into(),
            ));
        }
        if r.until.is_some_and(|u| u < start.date()) {
            return Err(AppError::Validation(
                "the repeat end date is before the first occurrence".into(),
            ));
        }
    }
    Ok(())
}

#[cfg(test)]
#[allow(clippy::unwrap_used)] // tests may unwrap: a panic is a test failure
mod tests {
    use super::*;
    use crate::calendar::recurrence::Freq;

    fn dt(s: &str) -> NaiveDateTime {
        NaiveDateTime::parse_from_str(s, "%Y-%m-%d %H:%M").unwrap()
    }

    fn event(all_day: bool, start: &str, end: &str, repeat: Option<RepeatDto>) -> Event {
        Event {
            id: Uuid::nil(),
            title: "t".into(),
            notes: String::new(),
            all_day,
            start: dt(start),
            end: dt(end),
            timezone: "Africa/Nairobi".into(),
            repeat,
            reminder_minutes: None,
            created_at: Utc::now().fixed_offset(),
            updated_at: Utc::now().fixed_offset(),
        }
    }

    #[test]
    fn check_rejects_bad_events() {
        let tz = "Africa/Nairobi";
        assert!(
            check(
                false,
                dt("2026-10-12 09:00"),
                dt("2026-10-12 10:00"),
                tz,
                None
            )
            .is_ok()
        );
        assert!(
            check(
                false,
                dt("2026-10-12 10:00"),
                dt("2026-10-12 09:00"),
                tz,
                None
            )
            .is_err()
        );
        assert!(
            check(
                false,
                dt("2026-10-12 09:00"),
                dt("2026-10-12 10:00"),
                "Mars/Base",
                None
            )
            .is_err()
        );
        assert!(
            check(
                true,
                dt("2026-10-12 09:00"),
                dt("2026-10-12 09:00"),
                tz,
                None
            )
            .is_err()
        );
        let both = RepeatDto {
            freq: Freq::Weekly,
            interval: 1,
            until: "2026-12-01".parse().ok(),
            count: Some(3),
        };
        assert!(
            check(
                false,
                dt("2026-10-12 09:00"),
                dt("2026-10-12 10:00"),
                tz,
                Some(&both)
            )
            .is_err()
        );
    }

    #[test]
    fn all_day_occurrence_covers_its_last_day() {
        // A two-day all-day event on 12-13 Oct, queried for 13 Oct only.
        let e = event(true, "2026-10-12 00:00", "2026-10-13 00:00", None);
        let got = expand(&e, dt("2026-10-13 00:00"), dt("2026-10-13 23:59"), 10).unwrap();
        assert_eq!(got.len(), 1);
        assert_eq!(got[0].ends_at.to_rfc3339(), "2026-10-13T21:00:00+00:00"); // 14 Oct 00:00 EAT
    }

    #[test]
    fn timed_occurrences_carry_local_and_utc_times() {
        let weekly = RepeatDto {
            freq: Freq::Weekly,
            interval: 1,
            until: None,
            count: None,
        };
        let e = event(false, "2026-10-05 09:00", "2026-10-05 10:30", Some(weekly));
        let got = expand(&e, dt("2026-10-12 00:00"), dt("2026-10-18 23:59"), 10).unwrap();
        assert_eq!(got.len(), 1);
        assert_eq!(got[0].start, dt("2026-10-12 09:00"));
        assert_eq!(got[0].end, dt("2026-10-12 10:30"));
        assert_eq!(got[0].starts_at.to_rfc3339(), "2026-10-12T06:00:00+00:00");
        assert!(got[0].repeats);
    }
}
