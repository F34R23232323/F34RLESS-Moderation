import type { Migration } from '../migrationRunner';
import type { RowDataPacket } from 'mysql2/promise';

const sql = (strings: TemplateStringsArray): string => strings.join('');

export const migration009: Migration = {
  id: '009_archives',
  up: async (conn) => {
    const statements = [
      sql`CREATE TABLE IF NOT EXISTS archives (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        code VARCHAR(32) NOT NULL,
        guild_id VARCHAR(20) NOT NULL,
        channel_id VARCHAR(20) NULL,
        filter_user_id VARCHAR(20) NULL,
        kind VARCHAR(24) NOT NULL DEFAULT 'manual',
        title VARCHAR(255) NULL,
        reason TEXT NULL,
        created_by VARCHAR(20) NULL,
        case_id BIGINT UNSIGNED NULL,
        automod_log_id BIGINT UNSIGNED NULL,
        message_count INT UNSIGNED NOT NULL DEFAULT 0,
        media_count INT UNSIGNED NOT NULL DEFAULT 0,
        total_bytes BIGINT UNSIGNED NOT NULL DEFAULT 0,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_archive_code (code),
        KEY idx_archives_guild (guild_id, created_at),
        KEY idx_archives_case (case_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

      sql`CREATE TABLE IF NOT EXISTS archive_messages (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        archive_id BIGINT UNSIGNED NOT NULL,
        message_id VARCHAR(20) NOT NULL,
        channel_id VARCHAR(20) NULL,
        author_id VARCHAR(20) NOT NULL,
        author_username VARCHAR(128) NOT NULL,
        author_nickname VARCHAR(128) NULL,
        author_avatar VARCHAR(255) NULL,
        author_is_bot TINYINT(1) NOT NULL DEFAULT 0,
        content TEXT NULL,
        embeds JSON NULL,
        stickers JSON NULL,
        referenced_message JSON NULL,
        created_at DATETIME NOT NULL,
        position INT UNSIGNED NOT NULL DEFAULT 0,
        KEY idx_am_archive (archive_id, position),
        CONSTRAINT fk_am_archive FOREIGN KEY (archive_id) REFERENCES archives(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

      sql`CREATE TABLE IF NOT EXISTS archive_media (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        archive_id BIGINT UNSIGNED NOT NULL,
        archive_message_id BIGINT UNSIGNED NULL,
        author_id VARCHAR(20) NULL,
        kind VARCHAR(16) NOT NULL,
        name VARCHAR(255) NULL,
        content_type VARCHAR(128) NULL,
        size BIGINT UNSIGNED NOT NULL DEFAULT 0,
        width INT UNSIGNED NULL,
        height INT UNSIGNED NULL,
        original_url TEXT NULL,
        data LONGBLOB NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        KEY idx_media_archive (archive_id),
        KEY idx_media_message (archive_message_id),
        KEY idx_media_author (archive_id, author_id, kind),
        CONSTRAINT fk_media_archive FOREIGN KEY (archive_id) REFERENCES archives(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    ];

    for (const statement of statements) {
      await conn.query(statement);
    }

    // MySQL has no `ADD COLUMN IF NOT EXISTS` — guard the ALTER via
    // information_schema so the migration is safe to re-run after a partial
    // (DDL-implicit-commit) failure.
    const [cols] = await conn.query<RowDataPacket[]>(
      "SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'automod_logs' AND COLUMN_NAME = 'archive_code'",
    );
    if (cols.length === 0) {
      await conn.query(sql`ALTER TABLE automod_logs ADD COLUMN archive_code VARCHAR(32) NULL`);
    }
  },
};
