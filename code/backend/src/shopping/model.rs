//! Domain type and request DTOs. JSON is camelCase to match the frontend.

use chrono::{DateTime, FixedOffset, NaiveDate};
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use validator::Validate;

use super::entity;
use crate::http::nullable;

/// Upper bound for a unit price: 10 million in major units. Keeps totals far from i64 overflow.
const MAX_UNIT_PRICE_CENTS: i64 = 1_000_000_000;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ShoppingItem {
    pub id: Uuid,
    pub name: String,
    pub quantity: i32,
    /// Minor units (cents). None = no price entered yet.
    pub unit_price_cents: Option<i64>,
    /// The buyer's local date; None = still to buy.
    pub bought_on: Option<NaiveDate>,
    pub created_at: DateTime<FixedOffset>,
    pub updated_at: DateTime<FixedOffset>,
}

impl From<entity::Model> for ShoppingItem {
    fn from(m: entity::Model) -> Self {
        Self {
            id: m.id,
            name: m.name,
            quantity: m.quantity,
            unit_price_cents: m.unit_price_cents,
            bought_on: m.bought_on,
            created_at: m.created_at,
            updated_at: m.updated_at,
        }
    }
}

#[derive(Debug, Deserialize, Validate)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
pub struct CreateShoppingItem {
    #[validate(length(min = 1, max = 200))]
    pub name: String,
    #[validate(range(min = 1, max = 10000))]
    pub quantity: Option<i32>,
    #[validate(range(min = 0, max = MAX_UNIT_PRICE_CENTS))]
    pub unit_price_cents: Option<i64>,
}

/// PATCH body. For the nullable fields, absent = leave alone, `null` = clear.
#[derive(Debug, Deserialize, Validate)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
pub struct UpdateShoppingItem {
    #[validate(length(min = 1, max = 200))]
    pub name: Option<String>,
    #[validate(range(min = 1, max = 10000))]
    pub quantity: Option<i32>,
    #[serde(default, deserialize_with = "nullable::deserialize")]
    #[validate(range(min = 0, max = MAX_UNIT_PRICE_CENTS))]
    pub unit_price_cents: Option<Option<i64>>,
    #[serde(default, deserialize_with = "nullable::deserialize")]
    pub bought_on: Option<Option<NaiveDate>>,
}
