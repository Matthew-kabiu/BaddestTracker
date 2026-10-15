//! HTTP adapters for /api/v1/budgets and /api/v1/expenses. Extract, call the service,
//! publish the live event, respond.

use std::sync::Arc;

use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
};
use uuid::Uuid;

use super::model::{CreateBudget, CreateExpense, OnQuery, RangeQuery, UpdateBudget, UpdateExpense};
use crate::{
    auth::AuthUser,
    error::AppError,
    events::{Event, Kind},
    http::extract::{ClientId, ValidQuery, ValidatedJson},
    http::respond,
    state::AppState,
};

/// GET /api/v1/budgets?on=YYYY-MM-DD
pub async fn list(
    State(state): State<Arc<AppState>>,
    user: AuthUser,
    ValidQuery(q): ValidQuery<OnQuery>,
) -> Result<impl IntoResponse, AppError> {
    Ok(respond::ok(
        state.budgets.summaries(&user.id, q.on).await?,
        "budgets",
    ))
}

/// POST /api/v1/budgets
pub async fn create(
    State(state): State<Arc<AppState>>,
    user: AuthUser,
    origin: ClientId,
    ValidatedJson(body): ValidatedJson<CreateBudget>,
) -> Result<impl IntoResponse, AppError> {
    let created = state.budgets.create(&user.id, body).await?;
    let event = Event::new(&user.id, Kind::BudgetCreated, created.id, origin);
    state.events.publish(event);
    Ok(respond::created(created, "budget created"))
}

/// PATCH /api/v1/budgets/{id}
pub async fn update(
    State(state): State<Arc<AppState>>,
    user: AuthUser,
    origin: ClientId,
    Path(id): Path<Uuid>,
    ValidatedJson(body): ValidatedJson<UpdateBudget>,
) -> Result<impl IntoResponse, AppError> {
    let updated = state.budgets.update(&user.id, id, body).await?;
    let event = Event::new(&user.id, Kind::BudgetUpdated, id, origin);
    state.events.publish(event);
    Ok(respond::ok(updated, "budget updated"))
}

/// DELETE /api/v1/budgets/{id}
pub async fn remove(
    State(state): State<Arc<AppState>>,
    user: AuthUser,
    origin: ClientId,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, AppError> {
    state.budgets.delete(&user.id, id).await?;
    let event = Event::new(&user.id, Kind::BudgetDeleted, id, origin);
    state.events.publish(event);
    Ok(StatusCode::NO_CONTENT)
}

/// GET /api/v1/expenses?from=YYYY-MM-DD&to=YYYY-MM-DD
pub async fn list_expenses(
    State(state): State<Arc<AppState>>,
    user: AuthUser,
    ValidQuery(q): ValidQuery<RangeQuery>,
) -> Result<impl IntoResponse, AppError> {
    Ok(respond::ok(
        state.budgets.expenses(&user.id, q.from, q.to).await?,
        "expenses",
    ))
}

/// POST /api/v1/expenses
pub async fn create_expense(
    State(state): State<Arc<AppState>>,
    user: AuthUser,
    origin: ClientId,
    ValidatedJson(body): ValidatedJson<CreateExpense>,
) -> Result<impl IntoResponse, AppError> {
    let created = state.budgets.create_expense(&user.id, body).await?;
    let event = Event::new(&user.id, Kind::ExpenseCreated, created.id, origin);
    state.events.publish(event);
    Ok(respond::created(created, "expense created"))
}

/// PATCH /api/v1/expenses/{id}
pub async fn update_expense(
    State(state): State<Arc<AppState>>,
    user: AuthUser,
    origin: ClientId,
    Path(id): Path<Uuid>,
    ValidatedJson(body): ValidatedJson<UpdateExpense>,
) -> Result<impl IntoResponse, AppError> {
    let updated = state.budgets.update_expense(&user.id, id, body).await?;
    let event = Event::new(&user.id, Kind::ExpenseUpdated, id, origin);
    state.events.publish(event);
    Ok(respond::ok(updated, "expense updated"))
}

/// DELETE /api/v1/expenses/{id}
pub async fn remove_expense(
    State(state): State<Arc<AppState>>,
    user: AuthUser,
    origin: ClientId,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, AppError> {
    state.budgets.delete_expense(&user.id, id).await?;
    let event = Event::new(&user.id, Kind::ExpenseDeleted, id, origin);
    state.events.publish(event);
    Ok(StatusCode::NO_CONTENT)
}
