import type { Migration } from '../migrationRunner';

export const migration030: Migration = {
  id: '030_sticky_message_delays',
  up: async (conn) => {
    await conn.query(`
      ALTER TABLE sticky_messages
        ADD COLUMN count_bot_messages TINYINT(1) NOT NULL DEFAULT 0 AFTER conversation_detection,
        ADD COLUMN delay_min_seconds INT UNSIGNED NOT NULL DEFAULT 0 AFTER repost_after_messages,
        ADD COLUMN delay_max_seconds INT UNSIGNED NOT NULL DEFAULT 0 AFTER delay_min_seconds
    `);
  },
};
