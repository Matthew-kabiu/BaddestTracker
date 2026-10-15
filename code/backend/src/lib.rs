//! Baddest Tracker backend. `main.rs` wires these modules together; tests import them here.

pub mod ai;
pub mod auth;
pub mod budget;
pub mod calendar;
pub mod config;
pub mod crypto;
pub mod db;
pub mod error;
pub mod events;
pub mod health;
pub mod http;
pub mod note;
pub mod notification;
pub mod shopping;
pub mod state;
pub mod telegram;
pub mod todo;
pub mod vault;
