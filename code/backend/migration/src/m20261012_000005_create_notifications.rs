//! Persistent in-app notifications (budget alerts, reminders). Pushed live over SSE too.

use sea_orm_migration::{prelude::*, schema::*};

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .create_table(
                Table::create()
                    .table(Notifications::Table)
                    .if_not_exists()
                    .col(pk_uuid(Notifications::Id))
                    .col(text(Notifications::UserId))
                    .col(text(Notifications::Kind))
                    .col(text(Notifications::Title))
                    .col(text(Notifications::Body))
                    // An in-app route to open, e.g. /dashboard/budget.
                    .col(text_null(Notifications::Link))
                    .col(timestamp_with_time_zone_null(Notifications::ReadAt))
                    .col(
                        timestamp_with_time_zone(Notifications::CreatedAt)
                            .default(Expr::current_timestamp()),
                    )
                    .to_owned(),
            )
            .await?;
        manager
            .create_index(
                Index::create()
                    .name("ix_notifications_user_created")
                    .table(Notifications::Table)
                    .col(Notifications::UserId)
                    .col(Notifications::CreatedAt)
                    .to_owned(),
            )
            .await
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .drop_table(Table::drop().table(Notifications::Table).to_owned())
            .await
    }
}

#[derive(DeriveIden)]
enum Notifications {
    Table,
    Id,
    UserId,
    Kind,
    Title,
    Body,
    Link,
    ReadAt,
    CreatedAt,
}
