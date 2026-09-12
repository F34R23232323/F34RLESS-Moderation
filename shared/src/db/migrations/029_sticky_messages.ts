import type { Migration } from '../migrationRunner';

export const migration029: Migration = {
  id: '029_sticky_messages',
  up: async (conn) => {
    await conn.query(`
      CREATE TABLE sticky_messages (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        guild_id VARCHAR(20) NOT NULL,
        channel_id VARCHAR(20) NOT NULL,
        saved_message_id BIGINT UNSIGNED NULL,
        payload JSON NULL,
        message_id VARCHAR(20) NULL,
        enabled TINYINT(1) NOT NULL DEFAULT 1,
        repost_after_messages INT UNSIGNED NOT NULL DEFAULT 5,
        conversation_detection TINYINT(1) NOT NULL DEFAULT 1,
        conversation_window_seconds INT UNSIGNED NOT NULL DEFAULT 60,
        conversation_min_messages INT UNSIGNED NOT NULL DEFAULT 4,
        quiet_period_seconds INT UNSIGNED NOT NULL DEFAULT 30,
        min_interval_seconds INT UNSIGNED NOT NULL DEFAULT 60,
        max_reposts_per_hour INT UNSIGNED NOT NULL DEFAULT 12,
        delete_previous TINYINT(1) NOT NULL DEFAULT 1,
        messages_since_post INT UNSIGNED NOT NULL DEFAULT 0,
        last_posted_at DATETIME NULL,
        created_by VARCHAR(20) NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uq_sticky_channel (guild_id, channel_id),
        KEY idx_sticky_enabled (enabled, guild_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  },
};
