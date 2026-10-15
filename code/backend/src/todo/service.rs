//! To-do business logic. Knows nothing about HTTP.

use uuid::Uuid;

use super::model::{CreateTodo, Todo, UpdateTodo};
use super::repository::Repository;
use crate::error::AppError;

pub struct Service {
    repo: Repository,
}

impl Service {
    pub fn new(repo: Repository) -> Self {
        Self { repo }
    }

    pub async fn list(&self, user_id: &str) -> Result<Vec<Todo>, AppError> {
        Ok(self
            .repo
            .list(user_id)
            .await?
            .into_iter()
            .map(Todo::from)
            .collect())
    }

    pub async fn create(&self, user_id: &str, input: CreateTodo) -> Result<Todo, AppError> {
        Ok(self
            .repo
            .insert(user_id, input.title.trim().to_owned())
            .await?
            .into())
    }

    pub async fn update(
        &self,
        user_id: &str,
        id: Uuid,
        input: UpdateTodo,
    ) -> Result<Todo, AppError> {
        // Someone else's to-do is reported as not found, so its existence never leaks.
        let existing = self
            .repo
            .find(user_id, id)
            .await?
            .ok_or(AppError::NotFound("to-do"))?;
        let title = input.title.map(|t| t.trim().to_owned());
        Ok(self.repo.update(existing, title, input.done).await?.into())
    }

    pub async fn delete(&self, user_id: &str, id: Uuid) -> Result<(), AppError> {
        if self.repo.delete(user_id, id).await? {
            Ok(())
        } else {
            Err(AppError::NotFound("to-do"))
        }
    }
}
