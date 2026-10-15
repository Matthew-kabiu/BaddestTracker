//! Shopping business logic. Knows nothing about HTTP.

use chrono::NaiveDate;
use uuid::Uuid;

use super::model::{CreateShoppingItem, ShoppingItem, UpdateShoppingItem};
use super::repository::{Changes, Repository};
use crate::error::AppError;

pub struct Service {
    repo: Repository,
}

impl Service {
    pub fn new(repo: Repository) -> Self {
        Self { repo }
    }

    pub async fn list(&self, user_id: &str) -> Result<Vec<ShoppingItem>, AppError> {
        Ok(self
            .repo
            .list(user_id)
            .await?
            .into_iter()
            .map(ShoppingItem::from)
            .collect())
    }

    /// Total spent on bought, priced items between two dates inclusive (unit price x quantity).
    pub async fn spent_between(
        &self,
        user_id: &str,
        from: NaiveDate,
        to: NaiveDate,
    ) -> Result<i64, AppError> {
        let items = self.repo.bought_between(user_id, from, to).await?;
        Ok(items
            .iter()
            .filter_map(|i| i.unit_price_cents.map(|p| p * i64::from(i.quantity)))
            .sum())
    }

    pub async fn create(
        &self,
        user_id: &str,
        input: CreateShoppingItem,
    ) -> Result<ShoppingItem, AppError> {
        Ok(self
            .repo
            .insert(
                user_id,
                input.name.trim().to_owned(),
                input.quantity.unwrap_or(1),
                input.unit_price_cents,
            )
            .await?
            .into())
    }

    pub async fn update(
        &self,
        user_id: &str,
        id: Uuid,
        input: UpdateShoppingItem,
    ) -> Result<ShoppingItem, AppError> {
        // Someone else's item is reported as not found, so its existence never leaks.
        let existing = self
            .repo
            .find(user_id, id)
            .await?
            .ok_or(AppError::NotFound("shopping item"))?;
        let changes = Changes {
            name: input.name.map(|n| n.trim().to_owned()),
            quantity: input.quantity,
            unit_price_cents: input.unit_price_cents,
            bought_on: input.bought_on,
        };
        Ok(self.repo.update(existing, changes).await?.into())
    }

    pub async fn delete(&self, user_id: &str, id: Uuid) -> Result<(), AppError> {
        if self.repo.delete(user_id, id).await? {
            Ok(())
        } else {
            Err(AppError::NotFound("shopping item"))
        }
    }
}
