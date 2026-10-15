//! Budget periods and the date window each one covers. Pure functions: no I/O, fully tested.
//! Recurring periods follow the calendar (weeks start Monday); `Custom` is a fixed range.

use chrono::{Datelike, Duration, NaiveDate};
use serde::{Deserialize, Serialize};

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Period {
    Daily,
    Weekly,
    Monthly,
    Quarterly,
    Yearly,
    Custom,
}

impl Period {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Daily => "daily",
            Self::Weekly => "weekly",
            Self::Monthly => "monthly",
            Self::Quarterly => "quarterly",
            Self::Yearly => "yearly",
            Self::Custom => "custom",
        }
    }

    /// Database text back to a period. Unknown text means a bad row, reported by the caller.
    pub fn parse(s: &str) -> Option<Self> {
        Some(match s {
            "daily" => Self::Daily,
            "weekly" => Self::Weekly,
            "monthly" => Self::Monthly,
            "quarterly" => Self::Quarterly,
            "yearly" => Self::Yearly,
            "custom" => Self::Custom,
            _ => return None,
        })
    }
}

/// Inclusive date range.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
pub struct Window {
    pub start: NaiveDate,
    pub end: NaiveDate,
}

impl Window {
    pub fn contains(&self, day: NaiveDate) -> bool {
        self.start <= day && day <= self.end
    }
}

/// The window of `period` that contains `on`. For `Custom` it is the stored range, whatever `on`
/// is. Returns None only for a `Custom` budget missing its dates (rejected at write time).
pub fn window(period: Period, on: NaiveDate, custom: Option<Window>) -> Option<Window> {
    let w = match period {
        Period::Daily => Window { start: on, end: on },
        Period::Weekly => {
            let start = on - Duration::days(i64::from(on.weekday().num_days_from_monday()));
            Window {
                start,
                end: start + Duration::days(6),
            }
        }
        Period::Monthly => month_span(on.year(), on.month(), 1),
        Period::Quarterly => month_span(on.year(), (on.month() - 1) / 3 * 3 + 1, 3),
        Period::Yearly => month_span(on.year(), 1, 12),
        Period::Custom => return custom,
    };
    Some(w)
}

/// `months` whole months starting on the 1st of (`year`, `month`).
fn month_span(year: i32, month: u32, months: u32) -> Window {
    let start = first_of(year, month);
    let (next_year, next_month) = add_months(year, month, months);
    Window {
        start,
        end: first_of(next_year, next_month) - Duration::days(1),
    }
}

fn add_months(year: i32, month: u32, months: u32) -> (i32, u32) {
    let zero_based = month - 1 + months;
    (year + (zero_based / 12) as i32, zero_based % 12 + 1)
}

fn first_of(year: i32, month: u32) -> NaiveDate {
    // Day 1 of a month 1..=12 always exists; MIN is unreachable and only avoids a panic path.
    NaiveDate::from_ymd_opt(year, month, 1).unwrap_or(NaiveDate::MIN)
}

#[cfg(test)]
#[allow(clippy::unwrap_used)] // tests may unwrap: a panic is a test failure
mod tests {
    use super::*;

    fn d(s: &str) -> NaiveDate {
        s.parse().unwrap()
    }

    fn w(period: Period, on: &str) -> (NaiveDate, NaiveDate) {
        let w = window(period, d(on), None).unwrap();
        (w.start, w.end)
    }

    #[test]
    fn daily_is_the_day() {
        assert_eq!(
            w(Period::Daily, "2026-10-12"),
            (d("2026-10-12"), d("2026-10-12"))
        );
    }

    #[test]
    fn weekly_runs_monday_to_sunday() {
        // 2026-10-12 is a Monday; 2026-10-18 the Sunday.
        assert_eq!(
            w(Period::Weekly, "2026-10-12"),
            (d("2026-10-12"), d("2026-10-18"))
        );
        assert_eq!(
            w(Period::Weekly, "2026-10-18"),
            (d("2026-10-12"), d("2026-10-18"))
        );
        assert_eq!(
            w(Period::Weekly, "2026-01-01"),
            (d("2025-12-29"), d("2026-01-04"))
        );
    }

    #[test]
    fn monthly_handles_short_months_and_leap_years() {
        assert_eq!(
            w(Period::Monthly, "2026-02-14"),
            (d("2026-02-01"), d("2026-02-28"))
        );
        assert_eq!(
            w(Period::Monthly, "2028-02-29"),
            (d("2028-02-01"), d("2028-02-29"))
        );
        assert_eq!(
            w(Period::Monthly, "2026-12-31"),
            (d("2026-12-01"), d("2026-12-31"))
        );
    }

    #[test]
    fn quarterly_aligns_to_calendar_quarters() {
        assert_eq!(
            w(Period::Quarterly, "2026-10-12"),
            (d("2026-10-01"), d("2026-12-31"))
        );
        assert_eq!(
            w(Period::Quarterly, "2026-03-31"),
            (d("2026-01-01"), d("2026-03-31"))
        );
        assert_eq!(
            w(Period::Quarterly, "2026-05-01"),
            (d("2026-04-01"), d("2026-06-30"))
        );
    }

    #[test]
    fn yearly_is_the_calendar_year() {
        assert_eq!(
            w(Period::Yearly, "2026-10-12"),
            (d("2026-01-01"), d("2026-12-31"))
        );
    }

    #[test]
    fn custom_is_the_stored_range() {
        let range = Window {
            start: d("2026-10-05"),
            end: d("2026-10-20"),
        };
        assert_eq!(
            window(Period::Custom, d("2027-01-01"), Some(range)),
            Some(range)
        );
        assert_eq!(window(Period::Custom, d("2026-10-12"), None), None);
    }

    #[test]
    fn period_text_round_trips() {
        for p in [
            Period::Daily,
            Period::Weekly,
            Period::Monthly,
            Period::Quarterly,
            Period::Yearly,
            Period::Custom,
        ] {
            assert_eq!(Period::parse(p.as_str()), Some(p));
        }
        assert_eq!(Period::parse("fortnightly"), None);
    }
}
