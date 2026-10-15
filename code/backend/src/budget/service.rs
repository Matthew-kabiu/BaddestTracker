//! Budget business logic: periods, spend totals (expenses + linked shopping) and the
//! once-per-period "over budget" alert. Knows nothing about HTTP.

use std::sync::Arc;

use chrono::{NaiveDate, Utc};
use sea_orm::Set;
use uuid::Uuid;

use super::budget_entity;
use super::expense_entity;
use super::model::{
    Budget, BudgetSummary, CreateBudget, CreateExpense, Expense, UpdateBudget, UpdateExpense,
};
use super::period::{self, Period, Window};
use super::repository::Repository;
use crate::{
    error::AppError,
    notification::{self, NewNotification},
    shopping,
};

/// Longest expense range one request may ask for (about five years).
const MAX_RANGE_DAYS: i64 = 366 * 5;

pub struct Service {
    repo: Repository,
    shopping: Arc<shopping::Service>,
    notifications: Arc<notification::Service>,
}

impl Service {
    pub fn new(
        repo: Repository,
        shopping: Arc<shopping::Service>,
        notifications: Arc<notification::Service>,
    ) -> Self {
        Self {
            repo,
            shopping,
            notifications,
        }
    }

    /* ─── Budgets ─── */

    /// Every budget with the window that contains `on` and what was spent in it.
    pub async fn summaries(
        &self,
        user_id: &str,
        on: NaiveDate,
    ) -> Result<Vec<BudgetSummary>, AppError> {
        let mut out = Vec::new();
        for row in self.repo.budgets(user_id).await? {
            let budget = parse(row)?;
            let window = window_of(&budget, on)?;
            let spent_cents = self.spent(user_id, &budget, window).await?;
            out.push(BudgetSummary {
                budget,
                window,
                spent_cents,
            });
        }
        Ok(out)
    }

    pub async fn create(&self, user_id: &str, input: CreateBudget) -> Result<Budget, AppError> {
        check_custom(input.period, input.custom_start, input.custom_end)?;
        let now = Utc::now().fixed_offset();
        let row = budget_entity::ActiveModel {
            id: Set(Uuid::new_v4()),
            user_id: Set(user_id.to_owned()),
            name: Set(input.name.trim().to_owned()),
            amount_cents: Set(input.amount_cents),
            period: Set(input.period.as_str().to_owned()),
            custom_start: Set(input.custom_start),
            custom_end: Set(input.custom_end),
            includes_shopping: Set(input.includes_shopping.unwrap_or(false)),
            alerted_for: Set(None),
            created_at: Set(now),
            updated_at: Set(now),
        };
        parse(self.repo.insert_budget(row).await?)
    }

    pub async fn update(
        &self,
        user_id: &str,
        id: Uuid,
        input: UpdateBudget,
    ) -> Result<Budget, AppError> {
        let existing = self.find_budget(user_id, id).await?;
        let current = parse(existing.clone())?;
        // Validate the budget as it will be after the change, not the patch on its own.
        let period = input.period.unwrap_or(current.period);
        let custom_start = input.custom_start.unwrap_or(current.custom_start);
        let custom_end = input.custom_end.unwrap_or(current.custom_end);
        check_custom(period, custom_start, custom_end)?;

        let mut row: budget_entity::ActiveModel = existing.into();
        if let Some(v) = input.name {
            row.name = Set(v.trim().to_owned());
        }
        if let Some(v) = input.amount_cents {
            row.amount_cents = Set(v);
        }
        if let Some(v) = input.includes_shopping {
            row.includes_shopping = Set(v);
        }
        row.period = Set(period.as_str().to_owned());
        row.custom_start = Set(custom_start);
        row.custom_end = Set(custom_end);
        // The amount or period may have changed, so a past alert no longer applies.
        row.alerted_for = Set(None);
        parse(self.repo.update_budget(row).await?)
    }

    pub async fn delete(&self, user_id: &str, id: Uuid) -> Result<(), AppError> {
        if self.repo.delete_budget(user_id, id).await? {
            Ok(())
        } else {
            Err(AppError::NotFound("budget"))
        }
    }

    /* ─── Expenses ─── */

    pub async fn expenses(
        &self,
        user_id: &str,
        from: NaiveDate,
        to: NaiveDate,
    ) -> Result<Vec<Expense>, AppError> {
        if from > to || (to - from).num_days() > MAX_RANGE_DAYS {
            return Err(AppError::Validation(
                "from must be on or before to, at most about five years apart".into(),
            ));
        }
        let rows = self
            .repo
            .expenses_between(
                user_id,
                Window {
                    start: from,
                    end: to,
                },
            )
            .await?;
        Ok(rows.into_iter().map(Expense::from).collect())
    }

    pub async fn create_expense(
        &self,
        user_id: &str,
        input: CreateExpense,
    ) -> Result<Expense, AppError> {
        if let Some(budget_id) = input.budget_id {
            self.find_budget(user_id, budget_id).await?;
        }
        let now = Utc::now().fixed_offset();
        let row = expense_entity::ActiveModel {
            id: Set(Uuid::new_v4()),
            user_id: Set(user_id.to_owned()),
            budget_id: Set(input.budget_id),
            amount_cents: Set(input.amount_cents),
            description: Set(input.description.trim().to_owned()),
            spent_on: Set(input.spent_on),
            created_at: Set(now),
            updated_at: Set(now),
        };
        let saved = self.repo.insert_expense(row).await?;
        self.check_alerts(user_id, saved.spent_on).await;
        Ok(saved.into())
    }

    pub async fn update_expense(
        &self,
        user_id: &str,
        id: Uuid,
        input: UpdateExpense,
    ) -> Result<Expense, AppError> {
        let existing = self
            .repo
            .expense(user_id, id)
            .await?
            .ok_or(AppError::NotFound("expense"))?;
        if let Some(Some(budget_id)) = input.budget_id {
            self.find_budget(user_id, budget_id).await?;
        }
        let old_day = existing.spent_on;
        let mut row: expense_entity::ActiveModel = existing.into();
        if let Some(v) = input.amount_cents {
            row.amount_cents = Set(v);
        }
        if let Some(v) = input.description {
            row.description = Set(v.trim().to_owned());
        }
        if let Some(v) = input.spent_on {
            row.spent_on = Set(v);
        }
        if let Some(v) = input.budget_id {
            row.budget_id = Set(v);
        }
        let saved = self.repo.update_expense(row).await?;
        self.check_alerts(user_id, saved.spent_on).await;
        if old_day != saved.spent_on {
            self.check_alerts(user_id, old_day).await;
        }
        Ok(saved.into())
    }

    pub async fn delete_expense(&self, user_id: &str, id: Uuid) -> Result<(), AppError> {
        let existing = self
            .repo
            .expense(user_id, id)
            .await?
            .ok_or(AppError::NotFound("expense"))?;
        self.repo.delete_expense(user_id, id).await?;
        self.check_alerts(user_id, existing.spent_on).await;
        Ok(())
    }

    /* ─── Alerts ─── */

    /// Spending on `day` changed (an expense, or a shopping purchase). For every budget whose
    /// window holds `day`: alert once when it goes over, and re-arm when it drops back under.
    /// The money was already saved, so a failure here is logged rather than failing the request.
    pub async fn check_alerts(&self, user_id: &str, day: NaiveDate) {
        if let Err(e) = self.try_check_alerts(user_id, day).await {
            tracing::warn!(error = ?e, "budget alert check failed");
        }
    }

    async fn try_check_alerts(&self, user_id: &str, day: NaiveDate) -> Result<(), AppError> {
        for row in self.repo.budgets(user_id).await? {
            let budget = parse(row.clone())?;
            let window = window_of(&budget, day)?;
            if !window.contains(day) {
                continue; // a custom range that does not cover this day
            }
            let spent = self.spent(user_id, &budget, window).await?;
            let over = spent > budget.amount_cents;
            let alerted = row.alerted_for == Some(window.start);
            if over && !alerted {
                self.notifications
                    .notify(user_id, over_budget(&budget, spent, window))
                    .await?;
                self.repo.set_alerted_for(row, Some(window.start)).await?;
            } else if !over && alerted {
                self.repo.set_alerted_for(row, None).await?;
            }
        }
        Ok(())
    }

    /* ─── Helpers ─── */

    async fn spent(&self, user_id: &str, budget: &Budget, window: Window) -> Result<i64, AppError> {
        let mut total = self
            .repo
            .spent_on_budget(user_id, budget.id, window)
            .await?;
        if budget.includes_shopping {
            total += self
                .shopping
                .spent_between(user_id, window.start, window.end)
                .await?;
        }
        Ok(total)
    }

    async fn find_budget(&self, user_id: &str, id: Uuid) -> Result<budget_entity::Model, AppError> {
        // Someone else's budget is reported as not found, so its existence never leaks.
        self.repo
            .budget(user_id, id)
            .await?
            .ok_or(AppError::NotFound("budget"))
    }
}

fn parse(row: budget_entity::Model) -> Result<Budget, AppError> {
    let id = row.id;
    Budget::from_row(row)
        .ok_or_else(|| AppError::Internal(anyhow::anyhow!("budget {id} has an unknown period")))
}

fn window_of(budget: &Budget, on: NaiveDate) -> Result<Window, AppError> {
    period::window(budget.period, on, budget.custom_range()).ok_or_else(|| {
        AppError::Internal(anyhow::anyhow!("custom budget {} has no range", budget.id))
    })
}

/// `custom` needs a start and an end, in order; every other period must have neither.
fn check_custom(
    period: Period,
    start: Option<NaiveDate>,
    end: Option<NaiveDate>,
) -> Result<(), AppError> {
    match (period, start, end) {
        (Period::Custom, Some(s), Some(e)) if s <= e => Ok(()),
        (Period::Custom, Some(_), Some(_)) => Err(AppError::Validation(
            "customStart must be on or before customEnd".into(),
        )),
        (Period::Custom, _, _) => Err(AppError::Validation(
            "a custom budget needs customStart and customEnd".into(),
        )),
        (_, None, None) => Ok(()),
        _ => Err(AppError::Validation(
            "customStart and customEnd are only for custom budgets".into(),
        )),
    }
}

fn over_budget(budget: &Budget, spent: i64, window: Window) -> NewNotification {
    NewNotification {
        kind: "budget.exceeded",
        title: format!("Over budget: {}", budget.name),
        body: format!(
            "{} spent of {} between {} and {}.",
            money(spent),
            money(budget.amount_cents),
            window.start.format("%-d %b"),
            window.end.format("%-d %b %Y"),
        ),
        link: Some("/dashboard/budget"),
    }
}

/// 15240 → "152.40". No currency symbol until the user's currency lives in Settings.
fn money(cents: i64) -> String {
    format!("{}.{:02}", cents / 100, (cents % 100).abs())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn d(s: &str) -> Option<NaiveDate> {
        s.parse().ok()
    }

    #[test]
    fn custom_needs_an_ordered_range() {
        assert!(check_custom(Period::Custom, d("2026-10-01"), d("2026-10-31")).is_ok());
        assert!(check_custom(Period::Custom, d("2026-10-31"), d("2026-10-01")).is_err());
        assert!(check_custom(Period::Custom, d("2026-10-01"), None).is_err());
    }

    #[test]
    fn recurring_periods_reject_custom_dates() {
        assert!(check_custom(Period::Monthly, None, None).is_ok());
        assert!(check_custom(Period::Monthly, d("2026-10-01"), None).is_err());
    }

    #[test]
    fn money_formats_cents() {
        assert_eq!(money(15240), "152.40");
        assert_eq!(money(5), "0.05");
        assert_eq!(money(100), "1.00");
    }
}
