import type { Migration } from '../migrationRunner';

export const migration018: Migration = {
  id: '018_roblox_links',
  up: async (conn) => {
    await conn.query(`
      CREATE TABLE IF NOT EXISTS roblox_links (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        user_id VARCHAR(20) NOT NULL,
        roblox_id VARCHAR(20) NOT NULL,
        roblox_username VARCHAR(64) NOT NULL,
        linked_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        KEY idx_roblox_links_user (user_id),
        UNIQUE KEY idx_roblox_links_roblox (roblox_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  },
};
