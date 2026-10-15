//! A user's own Telegram bot (token encrypted at rest) and the chat it delivers to.

use sea_orm_migration::{prelude::*, schema::*};

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .create_table(
                Table::create()
                    .table(TelegramLinks::Table)
                    .if_not_exists()
                    // One bot per user.
                    .col(text(TelegramLinks::UserId).primary_key())
                    .col(binary(TelegramLinks::TokenCiphertext))
                    .col(binary(TelegramLinks::TokenNonce))
                    .col(text(TelegramLinks::BotUsername))
                    // Set once the user presses Start in the bot with `link_code`.
                    .col(big_integer_null(TelegramLinks::ChatId))
                    .col(text_null(TelegramLinks::LinkCode))
                    .col(
                        timestamp_with_time_zone(TelegramLinks::CreatedAt)
                            .default(Expr::current_timestamp()),
                    )
                    .col(
                        timestamp_with_time_zone(TelegramLinks::UpdatedAt)
                            .default(Expr::current_timestamp()),
                    )
                    .to_owned(),
            )
            .await
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .drop_table(Table::drop().table(TelegramLinks::Table).to_owned())
            .await
    }
}

#[derive(DeriveIden)]
enum TelegramLinks {
    Table,
    UserId,
    TokenCiphertext,
    TokenNonce,
    BotUsername,
    ChatId,
    LinkCode,
    CreatedAt,
    UpdatedAt,
}
