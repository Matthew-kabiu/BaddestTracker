//! To-dos and notes. Every row is owned by a Better Auth user ID (text).

use sea_orm_migration::{prelude::*, schema::*};

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .create_table(
                Table::create()
                    .table(Todos::Table)
                    .if_not_exists()
                    .col(pk_uuid(Todos::Id))
                    .col(text(Todos::UserId))
                    .col(text(Todos::Title))
                    .col(boolean(Todos::Done).default(false))
                    .col(
                        timestamp_with_time_zone(Todos::CreatedAt)
                            .default(Expr::current_timestamp()),
                    )
                    .col(
                        timestamp_with_time_zone(Todos::UpdatedAt)
                            .default(Expr::current_timestamp()),
                    )
                    .to_owned(),
            )
            .await?;
        manager
            .create_index(
                Index::create()
                    .name("ix_todos_user_id")
                    .table(Todos::Table)
                    .col(Todos::UserId)
                    .to_owned(),
            )
            .await?;
        manager
            .create_table(
                Table::create()
                    .table(Notes::Table)
                    .if_not_exists()
                    .col(pk_uuid(Notes::Id))
                    .col(text(Notes::UserId))
                    .col(text(Notes::Title))
                    .col(text(Notes::Body))
                    .col(
                        timestamp_with_time_zone(Notes::CreatedAt)
                            .default(Expr::current_timestamp()),
                    )
                    .col(
                        timestamp_with_time_zone(Notes::UpdatedAt)
                            .default(Expr::current_timestamp()),
                    )
                    .to_owned(),
            )
            .await?;
        manager
            .create_index(
                Index::create()
                    .name("ix_notes_user_id")
                    .table(Notes::Table)
                    .col(Notes::UserId)
                    .to_owned(),
            )
            .await
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .drop_table(Table::drop().table(Notes::Table).to_owned())
            .await?;
        manager
            .drop_table(Table::drop().table(Todos::Table).to_owned())
            .await
    }
}

#[derive(DeriveIden)]
enum Todos {
    Table,
    Id,
    UserId,
    Title,
    Done,
    CreatedAt,
    UpdatedAt,
}

#[derive(DeriveIden)]
enum Notes {
    Table,
    Id,
    UserId,
    Title,
    Body,
    CreatedAt,
    UpdatedAt,
}
