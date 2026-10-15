//! Calendar events and the record of reminders already sent.
//! Times are stored as local wall-clock time plus an IANA time zone (as Google Calendar does),
//! so a 09:00 weekly meeting stays at 09:00 across daylight-saving changes.

use sea_orm_migration::{prelude::*, schema::*};

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .create_table(
                Table::create()
                    .table(Events::Table)
                    .if_not_exists()
                    .col(pk_uuid(Events::Id))
                    .col(text(Events::UserId))
                    .col(text(Events::Title))
                    .col(text(Events::Notes).default(""))
                    .col(boolean(Events::AllDay).default(false))
                    // Local wall-clock time in `timezone`. All-day: 00:00 on the first and last day.
                    .col(timestamp(Events::StartLocal))
                    .col(timestamp(Events::EndLocal))
                    .col(text(Events::Timezone))
                    // daily | weekly | monthly | yearly; NULL = does not repeat.
                    .col(text_null(Events::RepeatFreq))
                    .col(integer(Events::RepeatInterval).default(1))
                    .col(date_null(Events::RepeatUntil))
                    .col(integer_null(Events::RepeatCount))
                    // Minutes before the start; NULL = no reminder.
                    .col(integer_null(Events::ReminderMinutes))
                    .col(
                        timestamp_with_time_zone(Events::CreatedAt)
                            .default(Expr::current_timestamp()),
                    )
                    .col(
                        timestamp_with_time_zone(Events::UpdatedAt)
                            .default(Expr::current_timestamp()),
                    )
                    .to_owned(),
            )
            .await?;
        manager
            .create_index(
                Index::create()
                    .name("ix_events_user_id")
                    .table(Events::Table)
                    .col(Events::UserId)
                    .to_owned(),
            )
            .await?;
        manager
            .create_table(
                Table::create()
                    .table(ReminderDeliveries::Table)
                    .if_not_exists()
                    .col(uuid(ReminderDeliveries::EventId))
                    .col(timestamp_with_time_zone(
                        ReminderDeliveries::OccurrenceStart,
                    ))
                    .col(
                        timestamp_with_time_zone(ReminderDeliveries::SentAt)
                            .default(Expr::current_timestamp()),
                    )
                    // One reminder per occurrence, even across restarts.
                    .primary_key(
                        Index::create()
                            .col(ReminderDeliveries::EventId)
                            .col(ReminderDeliveries::OccurrenceStart),
                    )
                    .foreign_key(
                        ForeignKey::create()
                            .name("fk_reminder_deliveries_event_id")
                            .from(ReminderDeliveries::Table, ReminderDeliveries::EventId)
                            .to(Events::Table, Events::Id)
                            .on_delete(ForeignKeyAction::Cascade),
                    )
                    .to_owned(),
            )
            .await
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .drop_table(Table::drop().table(ReminderDeliveries::Table).to_owned())
            .await?;
        manager
            .drop_table(Table::drop().table(Events::Table).to_owned())
            .await
    }
}

#[derive(DeriveIden)]
enum Events {
    Table,
    Id,
    UserId,
    Title,
    Notes,
    AllDay,
    StartLocal,
    EndLocal,
    Timezone,
    RepeatFreq,
    RepeatInterval,
    RepeatUntil,
    RepeatCount,
    ReminderMinutes,
    CreatedAt,
    UpdatedAt,
}

#[derive(DeriveIden)]
enum ReminderDeliveries {
    Table,
    EventId,
    OccurrenceStart,
    SentAt,
}
