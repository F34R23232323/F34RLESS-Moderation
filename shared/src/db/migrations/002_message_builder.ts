import type { Migration } from '../migrationRunner';

const sql = (strings: TemplateStringsArray): string => strings.join('');

export const migration002: Migration = {
  id: '002_message_builder',
  up: async (conn) => {
    const statements = [
      sql`CREATE TABLE saved_messages (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        guild_id VARCHAR(20) NOT NULL,
        name VARCHAR(64) NOT NULL,
        kind VARCHAR(8) NOT NULL DEFAULT 'v1',
        payload JSON NOT NULL,
        created_by VARCHAR(20) NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        KEY idx_saved_guild (guild_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

      sql`CREATE TABLE sent_messages (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        saved_message_id BIGINT UNSIGNED NULL,
        guild_id VARCHAR(20) NOT NULL,
        channel_id VARCHAR(20) NOT NULL,
        message_id VARCHAR(20) NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        KEY idx_sent_saved (saved_message_id),
        KEY idx_sent_channel (guild_id, channel_id, message_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

      sql`CREATE TABLE message_send_requests (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        saved_message_id BIGINT UNSIGNED NOT NULL,
        guild_id VARCHAR(20) NOT NULL,
        channel_id VARCHAR(20) NOT NULL,
        mode VARCHAR(8) NOT NULL DEFAULT 'send',
        target_message_id VARCHAR(20) NULL,
        status VARCHAR(12) NOT NULL DEFAULT 'pending',
        error TEXT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        processed_at DATETIME NULL,
        KEY idx_msr_pending (status, created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

      sql`CREATE TABLE guild_channels (
        id VARCHAR(20) PRIMARY KEY,
        guild_id VARCHAR(20) NOT NULL,
        name VARCHAR(120) NOT NULL,
        type INT NOT NULL,
        parent_id VARCHAR(20) NULL,
        KEY idx_gc_guild (guild_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    ];

    for (const statement of statements) {
      await conn.query(statement);
    }
  },
};