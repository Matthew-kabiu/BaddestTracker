//! Tools the assistant may call. Every tool is a thin wrapper over an existing Service method,
//! called with the authenticated user's ID already bound — the model never gets a database
//! handle and never sees another user's data. The password vault is never exposed as a tool.
//!
//! To add a tool: implement `Tool` for a struct and add it to `all()`.

use std::sync::Arc;

use async_trait::async_trait;
use serde_json::Value;

use super::types::ToolSpec;
use crate::{auth::AuthUser, error::AppError, state::AppState};

/// What a tool may use: the shared state and the caller. Nothing else.
pub struct ToolContext<'a> {
    pub state: &'a Arc<AppState>,
    pub user: &'a AuthUser,
}

#[async_trait]
pub trait Tool: Send + Sync {
    fn spec(&self) -> ToolSpec;
    /// Returns a JSON value that is sent back to the model as the tool result.
    async fn call(&self, ctx: &ToolContext<'_>, args: Value) -> Result<Value, AppError>;
}

/// Every tool available to the assistant.
pub fn all() -> Vec<Box<dyn Tool>> {
    vec![
        Box::new(ListTodos),
        Box::new(CreateTodo),
        Box::new(CompleteTodo),
        Box::new(ListNotes),
        Box::new(CreateNote),
    ]
}

/// Parse the model's arguments into the same DTO the HTTP API uses, with the same validation,
/// so the assistant can never write anything a user could not.
fn parse<T: serde::de::DeserializeOwned + validator::Validate>(args: Value) -> Result<T, AppError> {
    let value: T = serde_json::from_value(args)
        .map_err(|_| AppError::Validation("tool arguments did not match the schema".into()))?;
    value
        .validate()
        .map_err(|_| AppError::Validation("tool arguments failed validation".into()))?;
    Ok(value)
}

fn to_json<T: serde::Serialize>(value: T) -> Result<Value, AppError> {
    serde_json::to_value(value).map_err(|e| AppError::Internal(e.into()))
}

fn spec(name: &str, description: &str, parameters: Value) -> ToolSpec {
    ToolSpec {
        name: name.into(),
        description: description.into(),
        parameters,
    }
}

struct ListTodos;

#[async_trait]
impl Tool for ListTodos {
    fn spec(&self) -> ToolSpec {
        spec(
            "list_todos",
            "List the user's to-dos (open first, newest first).",
            serde_json::json!({ "type": "object", "properties": {}, "additionalProperties": false }),
        )
    }
    async fn call(&self, ctx: &ToolContext<'_>, _args: Value) -> Result<Value, AppError> {
        to_json(ctx.state.todos.list(&ctx.user.id).await?)
    }
}

struct CreateTodo;

#[async_trait]
impl Tool for CreateTodo {
    fn spec(&self) -> ToolSpec {
        spec(
            "create_todo",
            "Add a to-do for the user.",
            serde_json::json!({
                "type": "object",
                "properties": { "title": { "type": "string", "minLength": 1, "maxLength": 500 } },
                "required": ["title"],
                "additionalProperties": false
            }),
        )
    }
    async fn call(&self, ctx: &ToolContext<'_>, args: Value) -> Result<Value, AppError> {
        let input: crate::todo::model::CreateTodo = parse(args)?;
        to_json(ctx.state.todos.create(&ctx.user.id, input).await?)
    }
}

struct CompleteTodo;

#[derive(serde::Deserialize, validator::Validate)]
#[serde(deny_unknown_fields)]
struct CompleteTodoArgs {
    id: uuid::Uuid,
}

#[async_trait]
impl Tool for CompleteTodo {
    fn spec(&self) -> ToolSpec {
        spec(
            "complete_todo",
            "Mark one of the user's to-dos as done. Get the id from list_todos first.",
            serde_json::json!({
                "type": "object",
                "properties": { "id": { "type": "string", "format": "uuid" } },
                "required": ["id"],
                "additionalProperties": false
            }),
        )
    }
    async fn call(&self, ctx: &ToolContext<'_>, args: Value) -> Result<Value, AppError> {
        let CompleteTodoArgs { id } = parse(args)?;
        let update = crate::todo::model::UpdateTodo {
            title: None,
            done: Some(true),
        };
        to_json(ctx.state.todos.update(&ctx.user.id, id, update).await?)
    }
}

struct ListNotes;

#[async_trait]
impl Tool for ListNotes {
    fn spec(&self) -> ToolSpec {
        spec(
            "list_notes",
            "List the user's notes (most recently edited first), including their full text.",
            serde_json::json!({ "type": "object", "properties": {}, "additionalProperties": false }),
        )
    }
    async fn call(&self, ctx: &ToolContext<'_>, _args: Value) -> Result<Value, AppError> {
        to_json(ctx.state.notes.list(&ctx.user.id).await?)
    }
}

struct CreateNote;

#[async_trait]
impl Tool for CreateNote {
    fn spec(&self) -> ToolSpec {
        spec(
            "create_note",
            "Create a note for the user.",
            serde_json::json!({
                "type": "object",
                "properties": {
                    "title": { "type": "string", "minLength": 1, "maxLength": 300 },
                    "body": { "type": "string", "maxLength": 100000 }
                },
                "required": ["title", "body"],
                "additionalProperties": false
            }),
        )
    }
    async fn call(&self, ctx: &ToolContext<'_>, args: Value) -> Result<Value, AppError> {
        let input: crate::note::model::CreateNote = parse(args)?;
        to_json(ctx.state.notes.create(&ctx.user.id, input).await?)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn tool_names_are_unique_and_schemas_are_objects() {
        let specs: Vec<ToolSpec> = all().iter().map(|t| t.spec()).collect();
        let mut names: Vec<&str> = specs.iter().map(|s| s.name.as_str()).collect();
        names.sort_unstable();
        names.dedup();
        assert_eq!(names.len(), specs.len());
        assert!(specs.iter().all(|s| s.parameters["type"] == "object"));
    }

    #[test]
    fn tool_args_reuse_api_validation() {
        let empty: Result<crate::todo::model::CreateTodo, _> =
            parse(serde_json::json!({ "title": "" }));
        assert!(empty.is_err());
        let smuggled: Result<crate::todo::model::CreateTodo, _> =
            parse(serde_json::json!({ "title": "x", "user_id": "someone-else" }));
        assert!(smuggled.is_err());
        let ok: Result<crate::todo::model::CreateTodo, _> =
            parse(serde_json::json!({ "title": "Buy milk" }));
        assert!(ok.is_ok());
    }
}
