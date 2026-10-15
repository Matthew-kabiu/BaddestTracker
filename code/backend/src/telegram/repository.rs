//! Database access for `telegram_links`. Every query is scoped by `user_id`.

use chrono::Utc;
use sea_orm::{
    ActiveModelTrait, ColumnTrait, DatabaseConnection, EntityTrait, QueryFilter, Set,
    sea_query::OnConflict,
};

use super::entity::{self, Entity as Links};
use crate::{crypto::Sealed, error::AppError};

pub struct Repository {
    db: DatabaseConnection,
}

impl Repository {
    pub fn new(db: DatabaseConnection) -> Self {
        Self { db }
    }

    pub async fn find(&self, user_id: &str) -> Result<Option<entity::Model>, AppError> {
        Ok(Links::find_by_id(user_id.to_owned()).one(&self.db).await?)
    }

    /// Save (or replace) the user's bot. Replacing unlinks: the new bot has a new chat.
    pub async fn save_bot(
        &self,
        user_id: &str,
        sealed: Sealed,
        bot_username: String,
        link_code: String,
    ) -> Result<(), AppError> {
        let now = Utc::now().fixed_offset();
        let row = entity::ActiveModel {
            user_id: Set(user_id.to_owned()),
            token_ciphertext: Set(sealed.ciphertext),
            token_nonce: Set(sealed.nonce),
            bot_username: Set(bot_username),
            chat_id: Set(None),
            link_code: Set(Some(link_code)),
            created_at: Set(now),
            updated_at: Set(now),
        };
        Links::insert(row)
            .on_conflict(
                OnConflict::column(entity::Column::UserId)
                    .update_columns([
                        entity::Column::TokenCiphertext,
                        entity::Column::TokenNonce,
                        entity::Column::BotUsername,
                        entity::Column::ChatId,
                        entity::Column::LinkCode,
                        entity::Column::UpdatedAt,
                    ])
                    .to_owned(),
            )
            .exec(&self.db)
            .await?;
        Ok(())
    }

    pub async fn set_chat(&self, existing: entity::Model, chat_id: i64) -> Result<(), AppError> {
        let mut row: entity::ActiveModel = existing.into();
        row.chat_id = Set(Some(chat_id));
        row.link_code = Set(None);
        row.updated_at = Set(Utc::now().fixed_offset());
        row.update(&self.db).await?;
        Ok(())
    }

    pub async fn delete(&self, user_id: &str) -> Result<bool, AppError> {
        let res = Links::delete_many()
            .filter(entity::Column::UserId.eq(user_id))
            .exec(&self.db)
            .await?;
        Ok(res.rows_affected > 0)
    }
}
