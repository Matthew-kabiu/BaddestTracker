//! Shopping list items. Money is integer minor units (cents), never floats.

use sea_orm_migration::{prelude::*, schema::*};

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .create_table(
                Table::create()
                    .table(ShoppingItems::Table)
                    .if_not_exists()
                    .col(pk_uuid(ShoppingItems::Id))
                    .col(text(ShoppingItems::UserId))
                    .col(text(ShoppingItems::Name))
                    .col(integer(ShoppingItems::Quantity).default(1))
                    .col(big_integer_null(ShoppingItems::UnitPriceCents))
                    // NULL = still to buy. A date (the buyer's local day), so budgets can count it.
                    .col(date_null(ShoppingItems::BoughtOn))
                    .col(
                        timestamp_with_time_zone(ShoppingItems::CreatedAt)
                            .default(Expr::current_timestamp()),
                    )
                    .col(
                        timestamp_with_time_zone(ShoppingItems::UpdatedAt)
                            .default(Expr::current_timestamp()),
                    )
                    .to_owned(),
            )
            .await?;
        manager
            .create_index(
                Index::create()
                    .name("ix_shopping_items_user_bought_on")
                    .table(ShoppingItems::Table)
                    .col(ShoppingItems::UserId)
                    .col(ShoppingItems::BoughtOn)
                    .to_owned(),
            )
            .await
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .drop_table(Table::drop().table(ShoppingItems::Table).to_owned())
            .await
    }
}

#[derive(DeriveIden)]
enum ShoppingItems {
    Table,
    Id,
    UserId,
    Name,
    Quantity,
    UnitPriceCents,
    BoughtOn,
    CreatedAt,
    UpdatedAt,
}
