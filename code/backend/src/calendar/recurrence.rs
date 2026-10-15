//! Repeating events and time zones. Pure functions: no I/O, fully tested.
//! Rules follow RFC 5545 (what Google and Outlook use): FREQ + INTERVAL + UNTIL or COUNT, and a
//! date that does not exist in a period (31 February, 29 February outside leap years) is skipped.

use chrono::{DateTime, Datelike, Duration, LocalResult, NaiveDate, NaiveDateTime, TimeZone, Utc};
use chrono_tz::Tz;
use serde::{Deserialize, Serialize};

/// Safety stop for the expansion loop (about 270 years of daily steps).
const MAX_STEPS: u64 = 100_000;

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Freq {
    Daily,
    Weekly,
    Monthly,
    Yearly,
}

impl Freq {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Daily => "daily",
            Self::Weekly => "weekly",
            Self::Monthly => "monthly",
            Self::Yearly => "yearly",
        }
    }

    pub fn parse(s: &str) -> Option<Self> {
        Some(match s {
            "daily" => Self::Daily,
            "weekly" => Self::Weekly,
            "monthly" => Self::Monthly,
            "yearly" => Self::Yearly,
            _ => return None,
        })
    }
}

/// Every `interval` days / weeks / months / years, optionally ending on `until` (inclusive) or
/// after `count` occurrences.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Repeat {
    pub freq: Freq,
    pub interval: u32,
    pub until: Option<NaiveDate>,
    pub count: Option<u32>,
}

/// Local start times of the occurrences starting within `[from, to]`, at most `limit` of them.
/// `first` is the series' first start. Without `repeat` there is one occurrence: `first`.
pub fn starts_between(
    first: NaiveDateTime,
    repeat: Option<&Repeat>,
    from: NaiveDateTime,
    to: NaiveDateTime,
    limit: usize,
) -> Vec<NaiveDateTime> {
    let Some(rule) = repeat else {
        return if (from..=to).contains(&first) {
            vec![first]
        } else {
            Vec::new()
        };
    };

    let mut out = Vec::new();
    let mut step: u64 = 0;
    // Occurrences produced so far (skipped dates do not count towards COUNT).
    let mut produced: u64 = 0;

    // Daily and weekly never skip, so jump close to `from` instead of walking from the start.
    if let Some(days) = fixed_days(rule)
        && from > first
    {
        step = u64::try_from(((from - first).num_days() / days).saturating_sub(1)).unwrap_or(0);
        produced = step;
    }

    while step <= MAX_STEPS {
        let candidate = nth(first, rule, step);
        step += 1;
        let Some(start) = candidate else { continue };
        if rule.count.is_some_and(|c| produced >= u64::from(c)) {
            break;
        }
        if rule.until.is_some_and(|u| start.date() > u) || start > to {
            break;
        }
        produced += 1;
        if start >= from {
            out.push(start);
            if out.len() >= limit {
                break;
            }
        }
    }
    out
}

/// Days between occurrences for fixed-length periods; None for months and years.
fn fixed_days(rule: &Repeat) -> Option<i64> {
    let unit = match rule.freq {
        Freq::Daily => 1,
        Freq::Weekly => 7,
        Freq::Monthly | Freq::Yearly => return None,
    };
    Some(unit * i64::from(rule.interval.max(1)))
}

/// The `n`th step of the series, or None when that date does not exist (e.g. 31 April).
fn nth(first: NaiveDateTime, rule: &Repeat, n: u64) -> Option<NaiveDateTime> {
    let interval = u64::from(rule.interval.max(1));
    let steps = i64::try_from(n.checked_mul(interval)?).ok()?;
    match rule.freq {
        Freq::Daily => first.checked_add_signed(Duration::try_days(steps)?),
        Freq::Weekly => first.checked_add_signed(Duration::try_days(steps.checked_mul(7)?)?),
        Freq::Monthly => {
            let months = i64::from(first.month0()) + steps;
            let year = i64::from(first.year()) + months.div_euclid(12);
            let month = u32::try_from(months.rem_euclid(12)).ok()? + 1;
            let date = NaiveDate::from_ymd_opt(i32::try_from(year).ok()?, month, first.day())?;
            Some(date.and_time(first.time()))
        }
        Freq::Yearly => {
            let year = i32::try_from(i64::from(first.year()) + steps).ok()?;
            let date = NaiveDate::from_ymd_opt(year, first.month(), first.day())?;
            Some(date.and_time(first.time()))
        }
    }
}

/// A wall-clock time in `tz` as an instant. In a daylight-saving overlap the earlier instant
/// is used; a time inside a gap (clocks jumped forward) moves forward by the gap.
pub fn to_utc(local: NaiveDateTime, tz: Tz) -> DateTime<Utc> {
    let resolved = match tz.from_local_datetime(&local) {
        LocalResult::Single(t) | LocalResult::Ambiguous(t, _) => Some(t),
        LocalResult::None => tz
            .from_local_datetime(&(local + Duration::hours(1)))
            .earliest(),
    };
    resolved.map_or_else(|| local.and_utc(), |t| t.with_timezone(&Utc))
}

#[cfg(test)]
#[allow(clippy::unwrap_used)] // tests may unwrap: a panic is a test failure
mod tests {
    use super::*;

    fn dt(s: &str) -> NaiveDateTime {
        NaiveDateTime::parse_from_str(s, "%Y-%m-%d %H:%M").unwrap()
    }

    fn rule(freq: Freq, interval: u32) -> Repeat {
        Repeat {
            freq,
            interval,
            until: None,
            count: None,
        }
    }

    fn days(v: &[NaiveDateTime]) -> Vec<String> {
        v.iter().map(|d| d.format("%Y-%m-%d").to_string()).collect()
    }

    #[test]
    fn single_event_only_inside_the_range() {
        let first = dt("2026-10-12 09:00");
        assert_eq!(
            starts_between(
                first,
                None,
                dt("2026-10-01 00:00"),
                dt("2026-10-31 23:59"),
                10
            ),
            vec![first]
        );
        assert!(
            starts_between(
                first,
                None,
                dt("2026-11-01 00:00"),
                dt("2026-11-30 23:59"),
                10
            )
            .is_empty()
        );
    }

    #[test]
    fn every_other_day() {
        let got = starts_between(
            dt("2026-10-01 08:00"),
            Some(&rule(Freq::Daily, 2)),
            dt("2026-10-01 00:00"),
            dt("2026-10-07 23:59"),
            10,
        );
        assert_eq!(
            days(&got),
            ["2026-10-01", "2026-10-03", "2026-10-05", "2026-10-07"]
        );
    }

    #[test]
    fn weekly_jumps_ahead_to_a_far_range() {
        let got = starts_between(
            dt("2020-01-06 18:00"), // a Monday
            Some(&rule(Freq::Weekly, 1)),
            dt("2026-10-12 00:00"),
            dt("2026-10-25 23:59"),
            10,
        );
        assert_eq!(days(&got), ["2026-10-12", "2026-10-19"]);
        assert_eq!(got[0].format("%H:%M").to_string(), "18:00");
    }

    #[test]
    fn monthly_on_the_31st_skips_short_months() {
        let got = starts_between(
            dt("2026-01-31 10:00"),
            Some(&rule(Freq::Monthly, 1)),
            dt("2026-01-01 00:00"),
            dt("2026-06-30 23:59"),
            10,
        );
        assert_eq!(days(&got), ["2026-01-31", "2026-03-31", "2026-05-31"]);
    }

    #[test]
    fn yearly_on_29_february_only_in_leap_years() {
        let got = starts_between(
            dt("2024-02-29 00:00"),
            Some(&rule(Freq::Yearly, 1)),
            dt("2024-01-01 00:00"),
            dt("2032-12-31 23:59"),
            10,
        );
        assert_eq!(days(&got), ["2024-02-29", "2028-02-29", "2032-02-29"]);
    }

    #[test]
    fn count_stops_the_series_and_skips_do_not_count() {
        let mut r = rule(Freq::Monthly, 1);
        r.count = Some(3);
        let got = starts_between(
            dt("2026-01-31 10:00"),
            Some(&r),
            dt("2026-01-01 00:00"),
            dt("2027-12-31 23:59"),
            10,
        );
        assert_eq!(days(&got), ["2026-01-31", "2026-03-31", "2026-05-31"]);
    }

    #[test]
    fn count_holds_when_the_range_starts_later() {
        let mut r = rule(Freq::Daily, 1);
        r.count = Some(5); // 1st..5th
        let got = starts_between(
            dt("2026-10-01 09:00"),
            Some(&r),
            dt("2026-10-04 00:00"),
            dt("2026-10-31 23:59"),
            10,
        );
        assert_eq!(days(&got), ["2026-10-04", "2026-10-05"]);
    }

    #[test]
    fn until_is_inclusive() {
        let mut r = rule(Freq::Weekly, 1);
        r.until = "2026-10-26".parse().ok();
        let got = starts_between(
            dt("2026-10-12 09:00"),
            Some(&r),
            dt("2026-10-01 00:00"),
            dt("2026-12-31 23:59"),
            10,
        );
        assert_eq!(days(&got), ["2026-10-12", "2026-10-19", "2026-10-26"]);
    }

    #[test]
    fn limit_caps_the_result() {
        let got = starts_between(
            dt("2026-01-01 09:00"),
            Some(&rule(Freq::Daily, 1)),
            dt("2026-01-01 00:00"),
            dt("2026-12-31 23:59"),
            7,
        );
        assert_eq!(got.len(), 7);
    }

    #[test]
    fn local_time_converts_with_daylight_saving() {
        let london: Tz = "Europe/London".parse().unwrap();
        // Winter: GMT (UTC+0). Summer: BST (UTC+1).
        assert_eq!(
            to_utc(dt("2026-01-15 09:00"), london).to_rfc3339(),
            "2026-01-15T09:00:00+00:00"
        );
        assert_eq!(
            to_utc(dt("2026-07-15 09:00"), london).to_rfc3339(),
            "2026-07-15T08:00:00+00:00"
        );
        // 01:30 on 29 March 2026 does not exist in London (clocks go 01:00 -> 02:00).
        assert_eq!(
            to_utc(dt("2026-03-29 01:30"), london).to_rfc3339(),
            "2026-03-29T01:30:00+00:00"
        );
        let nairobi: Tz = "Africa/Nairobi".parse().unwrap();
        assert_eq!(
            to_utc(dt("2026-10-12 09:00"), nairobi).to_rfc3339(),
            "2026-10-12T06:00:00+00:00"
        );
    }
}
