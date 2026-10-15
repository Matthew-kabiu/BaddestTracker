//! Everything handlers share. Built once in `main`, wrapped in `Arc`, cloned per request
//! (an `Arc` clone copies a pointer, not the data).

use std::sync::Arc;

use sea_orm::DatabaseConnection;

use crate::{
    budget, calendar, config::Config, events, note, notification, shopping, telegram, todo, vault,
};

pub struct AppState {
    pub config: Config,
    pub db: DatabaseConnection,
    /// One outbound HTTP client for the whole process (auth checks, AI providers). Has a timeout.
    pub http: reqwest::Client,
    pub todos: todo::Service,
    pub notes: note::Service,
    pub shopping: Arc<shopping::Service>,
    pub notifications: Arc<notification::Service>,
    pub budgets: budget::Service,
    pub calendar: calendar::Service,
    pub telegram: Arc<telegram::Service>,
    pub vault: vault::Service,
    /// Live event fan-out to the user's open tabs (see `events`).
    pub events: events::Hub,
}
