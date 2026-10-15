//! Budgets and expenses. A budget is an amount per period (daily … yearly, or a custom range);
//! its spend is the expenses filed under it plus, when linked, bought shopping items.

mod budget_entity;
mod expense_entity;
mod handler;
pub mod model;
pub mod period;
mod repository;
mod service;

use std::sync::Arc;

use axum::{
    Router,
    routing::{get, patch},
};
use sea_orm::DatabaseConnection;

pub use service::Service;

use crate::{notification, shopping, state::AppState};

pub fn service(
    db: DatabaseConnection,
    shopping: Arc<shopping::Service>,
    notifications: Arc<notification::Service>,
) -> Service {
    Service::new(repository::Repository::new(db), shopping, notifications)
}

/// Routes nested under `/api/v1/budgets`.
pub fn routes() -> Router<Arc<AppState>> {
    Router::new()
        .route("/", get(handler::list).post(handler::create))
        .route("/{id}", patch(handler::update).delete(handler::remove))
}

/// Routes nested under `/api/v1/expenses`.
pub fn expense_routes() -> Router<Arc<AppState>> {
    Router::new()
        .route(
            "/",
            get(handler::list_expenses).post(handler::create_expense),
        )
        .route(
            "/{id}",
            patch(handler::update_expense).delete(handler::remove_expense),
        )
}
