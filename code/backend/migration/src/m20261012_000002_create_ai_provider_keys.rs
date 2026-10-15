//! BYOK AI provider keys, encrypted at rest. One row per (user, provider).

use sea_orm_migration::{prelude::*, schema::*};

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .create_table(
                Table::create()
                    .table(AiProviderKeys::Table)
                    .if_not_exists()
                    .col(pk_uuid(AiProviderKeys::Id))
                    .col(text(AiProviderKeys::UserId))
                    .col(text(AiProviderKeys::Provider))
                    .col(text(AiProviderKeys::Model))
                    .col(binary(AiProviderKeys::Ciphertext))
                    .col(binary(AiProviderKeys::Nonce))
                    .col(
                        timestamp_with_time_zone(AiProviderKeys::CreatedAt)
                            .default(Expr::current_timestamp()),
                    )
                    .col(
                        timestamp_with_time_zone(AiProviderKeys::UpdatedAt)
                            .default(Expr::current_timestamp()),
                    )
                    .to_owned(),
            )
            .await?;
        manager
            .create_index(
                Index::create()
                    .name("ux_ai_provider_keys_user_provider")
                    .table(AiProviderKeys::Table)
                    .col(AiProviderKeys::UserId)
                    .col(AiProviderKeys::Provider)
                    .unique()
                    .to_owned(),
            )
            .await
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .drop_table(Table::drop().table(AiProviderKeys::Table).to_owned())
            .await
    }
}

#[derive(DeriveIden)]
enum AiProviderKeys {
    Table,
    Id,
    UserId,
    Provider,
    Model,
    Ciphertext,
    Nonce,
    CreatedAt,
    UpdatedAt,
}
