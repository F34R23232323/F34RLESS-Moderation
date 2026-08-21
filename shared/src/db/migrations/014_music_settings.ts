import type { Migration } from '../migrationRunner';

// Per-guild music settings (24/7 mode, volume, channels) plus a persisted
// queue snapshot so 24/7 sessions survive bot restarts.
export const migration014: Migration = {
  id: '014_music_settings',
  up: async (conn) => {
    await conn.query(`
      CREATE TABLE IF NOT EXISTS music_settings (
        guild_id VARCHAR(20) PRIMARY KEY,
        twenty_four_seven TINYINT(1) NOT NULL DEFAULT 0,
        volume INT NOT NULL DEFAULT 100,
        text_channel_id VARCHAR(20) NULL,
        voice_channel_id VARCHAR(20) NULL,
        autoplay TINYINT(1) NOT NULL DEFAULT 0,
        queue JSON NULL,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  },
};