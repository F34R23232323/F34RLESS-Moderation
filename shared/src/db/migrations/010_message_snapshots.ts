import type { Migration } from '../migrationRunner';

const sql = (strings: TemplateStringsArray): string => strings.join('');

export const migration010: Migration = {
  id: '010_message_snapshots',
  up: async (conn) => {
    const statements = [
      sql`CREATE TABLE IF NOT EXISTS message_snapshots (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        guild_id VARCHAR(20) NOT NULL,
        channel_id VARCHAR(20) NULL,
        message_id VARCHAR(20) NOT NULL,
        author_id VARCHAR(20) NOT NULL,
        author_username VARCHAR(128) NOT NULL,
        author_nickname VARCHAR(128) NULL,
        author_avatar VARCHAR(255) NULL,
        author_is_bot TINYINT(1) NOT NULL DEFAULT 0,
        content TEXT NULL,
        embeds JSON NULL,
        components JSON NULL,
        stickers JSON NULL,
        referenced_message JSON NULL,
        attachments JSON NULL,
        edits JSON NULL,
        edit_count INT UNSIGNED NOT NULL DEFAULT 0,
        created_at DATETIME NOT NULL,
        captured_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NULL,
        deleted_at DATETIME NULL,
        UNIQUE KEY uq_snap_msg (message_id),
        KEY idx_snap_guild_user (guild_id, author_id, created_at),
        KEY idx_snap_guild_channel (guild_id, channel_id, created_at),
        KEY idx_snap_deleted (deleted_at),
        KEY idx_snap_updated (updated_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

      sql`CREATE TABLE IF NOT EXISTS guild_users (
        guild_id VARCHAR(20) NOT NULL,
        user_id VARCHAR(20) NOT NULL,
        username VARCHAR(128) NOT NULL,
        display_name VARCHAR(128) NULL,
        avatar VARCHAR(255) NULL,
        is_bot TINYINT(1) NOT NULL DEFAULT 0,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (guild_id, user_id),
        KEY idx_users_name (guild_id, username)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    ];

    for (const statement of statements) {
      await conn.query(statement);
    }
  },
};
