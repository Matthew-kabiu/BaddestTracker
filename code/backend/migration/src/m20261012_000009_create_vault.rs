//! End-to-end encrypted password vault. The server stores only what the browser encrypted:
//! the wrapped vault key (by master password and by recovery key) and opaque item blobs.
//! See docs/Vault-Threat-Model.md.

use sea_orm_migration::{prelude::*, schema::*};

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .create_table(
                Table::create()
                    .table(VaultKeys::Table)
                    .if_not_exists()
                    .col(text(VaultKeys::UserId).primary_key())
                    // Key derivation settings, so they can be raised later per user.
                    .col(text(VaultKeys::Kdf))
                    .col(integer(VaultKeys::KdfMemoryKib))
                    .col(integer(VaultKeys::KdfIterations))
                    .col(integer(VaultKeys::KdfParallelism))
                    .col(binary(VaultKeys::Salt))
                    // Vault key encrypted with the master-password key.
                    .col(binary(VaultKeys::WrappedKey))
                    .col(binary(VaultKeys::WrapNonce))
                    // The same vault key encrypted with the recovery key.
                    .col(binary(VaultKeys::RecoveryWrappedKey))
                    .col(binary(VaultKeys::RecoveryNonce))
                    .col(
                        timestamp_with_time_zone(VaultKeys::CreatedAt)
                            .default(Expr::current_timestamp()),
                    )
                    .col(
                        timestamp_with_time_zone(VaultKeys::UpdatedAt)
                            .default(Expr::current_timestamp()),
                    )
                    .to_owned(),
            )
            .await?;
        manager
            .create_table(
                Table::create()
                    .table(VaultItems::Table)
                    .if_not_exists()
                    // Chosen by the browser, because it is bound into the item's encryption.
                    .col(pk_uuid(VaultItems::Id))
                    .col(text(VaultItems::UserId))
                    .col(binary(VaultItems::Ciphertext))
                    .col(binary(VaultItems::Nonce))
                    .col(
                        timestamp_with_time_zone(VaultItems::CreatedAt)
                            .default(Expr::current_timestamp()),
                    )
                    .col(
                        timestamp_with_time_zone(VaultItems::UpdatedAt)
                            .default(Expr::current_timestamp()),
                    )
                    .to_owned(),
            )
            .await?;
        manager
            .create_index(
                Index::create()
                    .name("ix_vault_items_user_id")
                    .table(VaultItems::Table)
                    .col(VaultItems::UserId)
                    .to_owned(),
            )
            .await
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .drop_table(Table::drop().table(VaultItems::Table).to_owned())
            .await?;
        manager
            .drop_table(Table::drop().table(VaultKeys::Table).to_owned())
            .await
    }
}

#[derive(DeriveIden)]
enum VaultKeys {
    Table,
    UserId,
    Kdf,
    KdfMemoryKib,
    KdfIterations,
    KdfParallelism,
    Salt,
    WrappedKey,
    WrapNonce,
    RecoveryWrappedKey,
    RecoveryNonce,
    CreatedAt,
    UpdatedAt,
}

#[derive(DeriveIden)]
enum VaultItems {
    Table,
    Id,
    UserId,
    Ciphertext,
    Nonce,
    CreatedAt,
    UpdatedAt,
}
