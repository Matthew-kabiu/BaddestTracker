//! Domain types and request DTOs. JSON is camelCase to match the frontend.

use chrono::{DateTime, FixedOffset, NaiveDate};
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use validator::Validate;

use super::period::{Period, Window};
use super::{budget_entity, expense_entity};
use crate::http::nullable;

/// 10 billion in major units: keeps sums far from i64 overflow.
const MAX_AMOUNT_CENTS: i64 = 1_000_000_000_000;

/// A budget as stored. Returned by create/update.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Budget {
    pub id: Uuid,
    pub name: String,
    pub amount_cents: i64,
    pub period: Period,
    pub custom_start: Option<NaiveDate>,
    pub custom_end: Option<NaiveDate>,
    pub includes_shopping: bool,
    pub created_at: DateTime<FixedOffset>,
    pub updated_at: DateTime<FixedOffset>,
}

impl Budget {
    /// None if the stored period text is unknown (a corrupt row).
    pub fn from_row(m: budget_entity::Model) -> Option<Self> {
        Some(Self {
            id: m.id,
            period: Period::parse(&m.period)?,
            name: m.name,
            amount_cents: m.amount_cents,
            custom_start: m.custom_start,
            custom_end: m.custom_end,
            includes_shopping: m.includes_shopping,
            created_at: m.created_at,
            updated_at: m.updated_at,
        })
    }

    pub fn custom_range(&self) -> Option<Window> {
        Some(Window {
            start: self.custom_start?,
            end: self.custom_end?,
        })
    }
}

/// A budget with its current window and what has been spent in it. Returned by the list.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BudgetSummary {
    #[serde(flatten)]
    pub budget: Budget,
    pub window: Window,
    pub spent_cents: i64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Expense {
    pub id: Uuid,
    pub budget_id: Option<Uuid>,
    pub amount_cents: i64,
    pub description: String,
    pub spent_on: NaiveDate,
    pub created_at: DateTime<FixedOffset>,
    pub updated_at: DateTime<FixedOffset>,
}

impl From<expense_entity::Model> for Expense {
    fn from(m: expense_entity::Model) -> Self {
        Self {
            id: m.id,
            budget_id: m.budget_id,
            amount_cents: m.amount_cents,
            description: m.description,
            spent_on: m.spent_on,
            created_at: m.created_at,
            updated_at: m.updated_at,
        }
    }
}

#[derive(Debug, Deserialize, Validate)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
pub struct CreateBudget {
    #[validate(length(min = 1, max = 100))]
    pub name: String,
    #[validate(range(min = 1, max = MAX_AMOUNT_CENTS))]
    pub amount_cents: i64,
    pub period: Period,
    /// Both required for `custom`, both absent otherwise.
    pub custom_start: Option<NaiveDate>,
    pub custom_end: Option<NaiveDate>,
    pub includes_shopping: Option<bool>,
}

/// PATCH body. For the nullable fields, absent = leave alone, `null` = clear.
#[derive(Debug, Deserialize, Validate)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
pub struct UpdateBudget {
    #[validate(length(min = 1, max = 100))]
    pub name: Option<String>,
    #[validate(range(min = 1, max = MAX_AMOUNT_CENTS))]
    pub amount_cents: Option<i64>,
    pub period: Option<Period>,
    #[serde(default, deserialize_with = "nullable::deserialize")]
    pub custom_start: Option<Option<NaiveDate>>,
    #[serde(default, deserialize_with = "nullable::deserialize")]
    pub custom_end: Option<Option<NaiveDate>>,
    pub includes_shopping: Option<bool>,
}

#[derive(Debug, Deserialize, Validate)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
pub struct CreateExpense {
    #[validate(range(min = 1, max = MAX_AMOUNT_CENTS))]
    pub amount_cents: i64,
    #[validate(length(max = 200))]
    #[serde(default)]
    pub description: String,
    pub spent_on: NaiveDate,
    pub budget_id: Option<Uuid>,
}

#[derive(Debug, Deserialize, Validate)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
pub struct UpdateExpense {
    #[validate(range(min = 1, max = MAX_AMOUNT_CENTS))]
    pub amount_cents: Option<i64>,
    #[validate(length(max = 200))]
    pub description: Option<String>,
    pub spent_on: Option<NaiveDate>,
    #[serde(default, deserialize_with = "nullable::deserialize")]
    pub budget_id: Option<Option<Uuid>>,
}

/// `?on=YYYY-MM-DD`: the caller's local today, which picks each budget's current window.
#[derive(Debug, Deserialize)]
pub struct OnQuery {
    pub on: NaiveDate,
}

/// `?from=YYYY-MM-DD&to=YYYY-MM-DD`, inclusive.
#[derive(Debug, Deserialize)]
pub struct RangeQuery {
    pub from: NaiveDate,
    pub to: NaiveDate,
}
