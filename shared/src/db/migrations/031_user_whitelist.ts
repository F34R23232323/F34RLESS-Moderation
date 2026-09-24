import type { Migration } from '../migrationRunner';

export const migration031: Migration = {
  id: '031_user_whitelist',
  up: async (conn) => {
    await conn.query(`
      CREATE TABLE IF NOT EXISTS user_whitelist (
        id INT AUTO_INCREMENT PRIMARY KEY,
        guild_id VARCHAR(20) NOT NULL,
        user_id VARCHAR(20) NOT NULL,
        scope VARCHAR(50) NOT NULL DEFAULT 'all',
        reason VARCHAR(500) DEFAULT NULL,
        added_by VARCHAR(20) NOT NULL,
        added_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY unique_guild_user_scope (guild_id, user_id, scope),
        INDEX idx_guild_user (guild_id, user_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  },
};
