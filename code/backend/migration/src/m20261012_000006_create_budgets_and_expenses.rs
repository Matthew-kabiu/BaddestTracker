//! Budgets (an amount per period) and expenses (money spent, optionally against a budget).
//! Money is integer minor units (cents), never floats.

use sea_orm_migration::{prelude::*, schema::*};

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .create_table(
                Table::create()
                    .table(Budgets::Table)
                    .if_not_exists()
                    .col(pk_uuid(Budgets::Id))
                    .col(text(Budgets::UserId))
                    .col(text(Budgets::Name))
                    .col(big_integer(Budgets::AmountCents))
                    // daily | weekly | monthly | quarterly | yearly | custom
                    .col(text(Budgets::Period))
                    .col(date_null(Budgets::CustomStart))
                    .col(date_null(Budgets::CustomEnd))
                    // Bought shopping items count against this budget too.
                    .col(boolean(Budgets::IncludesShopping).default(false))
                    // Start of the period we last sent an "over budget" alert for (one per period).
                    .col(date_null(Budgets::AlertedFor))
                    .col(
                        timestamp_with_time_zone(Budgets::CreatedAt)
                            .default(Expr::current_timestamp()),
                    )
                    .col(
                        timestamp_with_time_zone(Budgets::UpdatedAt)
                            .default(Expr::current_timestamp()),
                    )
                    .to_owned(),
            )
            .await?;
        manager
            .create_index(
                Index::create()
                    .name("ix_budgets_user_id")
                    .table(Budgets::Table)
                    .col(Budgets::UserId)
                    .to_owned(),
            )
            .await?;
        manager
            .create_table(
                Table::create()
                    .table(Expenses::Table)
                    .if_not_exists()
                    .col(pk_uuid(Expenses::Id))
                    .col(text(Expenses::UserId))
                    .col(uuid_null(Expenses::BudgetId))
                    .col(big_integer(Expenses::AmountCents))
                    .col(text(Expenses::Description))
                    .col(date(Expenses::SpentOn))
                    .col(
                        timestamp_with_time_zone(Expenses::CreatedAt)
                            .default(Expr::current_timestamp()),
                    )
                    .col(
                        timestamp_with_time_zone(Expenses::UpdatedAt)
                            .default(Expr::current_timestamp()),
                    )
                    // Deleting a budget keeps its expenses, just uncategorised.
                    .foreign_key(
                        ForeignKey::create()
                            .name("fk_expenses_budget_id")
                            .from(Expenses::Table, Expenses::BudgetId)
                            .to(Budgets::Table, Budgets::Id)
                            .on_delete(ForeignKeyAction::SetNull),
                    )
                    .to_owned(),
            )
            .await?;
        manager
            .create_index(
                Index::create()
                    .name("ix_expenses_user_spent_on")
                    .table(Expenses::Table)
                    .col(Expenses::UserId)
                    .col(Expenses::SpentOn)
                    .to_owned(),
            )
            .await
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .drop_table(Table::drop().table(Expenses::Table).to_owned())
            .await?;
        manager
            .drop_table(Table::drop().table(Budgets::Table).to_owned())
            .await
    }
}

#[derive(DeriveIden)]
enum Budgets {
    Table,
    Id,
    UserId,
    Name,
    AmountCents,
    Period,
    CustomStart,
    CustomEnd,
    IncludesShopping,
    AlertedFor,
    CreatedAt,
    UpdatedAt,
}

#[derive(DeriveIden)]
enum Expenses {
    Table,
    Id,
    UserId,
    BudgetId,
    AmountCents,
    Description,
    SpentOn,
    CreatedAt,
    UpdatedAt,
}
