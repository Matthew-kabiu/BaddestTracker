//! Notification logic. Saving, pushing live and delivering to linked channels happen together,
//! so no module can do one without the others. Knows nothing about HTTP.

use std::sync::Arc;

use uuid::Uuid;

use super::model::{Inbox, NewNotification, Notification};
use super::repository::Repository;
use crate::{
    error::AppError,
    events::{self, Event, Kind},
    http::extract::ClientId,
    telegram,
};

pub struct Service {
    repo: Repository,
    events: events::Hub,
    telegram: Arc<telegram::Service>,
}

impl Service {
    pub fn new(repo: Repository, events: events::Hub, telegram: Arc<telegram::Service>) -> Self {
        Self {
            repo,
            events,
            telegram,
        }
    }

    pub async fn inbox(&self, user_id: &str) -> Result<Inbox, AppError> {
        let items = self.repo.latest(user_id).await?;
        Ok(Inbox {
            items: items.into_iter().map(Notification::from).collect(),
            unread_count: self.repo.unread_count(user_id).await?,
        })
    }

    /// Save a notification for `user_id`, push it to their open tabs, and send it to their
    /// linked Telegram chat (a channel failure is logged, never returned).
    pub async fn notify(
        &self,
        user_id: &str,
        new: NewNotification,
    ) -> Result<Notification, AppError> {
        let saved = self.repo.insert(user_id, new).await?;
        let event = Event::new(user_id, Kind::NotificationCreated, saved.id, ClientId(None));
        self.events.publish(event);
        self.telegram
            .deliver(user_id, &saved.title, &saved.body)
            .await;
        Ok(saved.into())
    }

    pub async fn set_read(
        &self,
        user_id: &str,
        id: Uuid,
        read: bool,
        origin: ClientId,
    ) -> Result<Notification, AppError> {
        let existing = self
            .repo
            .find(user_id, id)
            .await?
            .ok_or(AppError::NotFound("notification"))?;
        let updated = self.repo.set_read(existing, read).await?;
        self.events
            .publish(Event::new(user_id, Kind::NotificationUpdated, id, origin));
        Ok(updated.into())
    }

    /// The event carries the nil id: "all of them", clients refetch either way.
    pub async fn mark_all_read(&self, user_id: &str, origin: ClientId) -> Result<(), AppError> {
        self.repo.mark_all_read(user_id).await?;
        let event = Event::new(user_id, Kind::NotificationUpdated, Uuid::nil(), origin);
        self.events.publish(event);
        Ok(())
    }

    pub async fn delete(&self, user_id: &str, id: Uuid, origin: ClientId) -> Result<(), AppError> {
        if !self.repo.delete(user_id, id).await? {
            return Err(AppError::NotFound("notification"));
        }
        self.events
            .publish(Event::new(user_id, Kind::NotificationDeleted, id, origin));
        Ok(())
    }
}
