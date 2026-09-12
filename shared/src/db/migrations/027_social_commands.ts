import type { Migration } from '../migrationRunner';

export const migration027: Migration = {
  id: '027_social_commands',
  up: async (conn) => {
    await conn.query(`
      CREATE TABLE IF NOT EXISTS social_blocks (
        blocker_id VARCHAR(20) NOT NULL,
        blocked_id VARCHAR(20) NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (blocker_id, blocked_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS social_disabled (
        user_id VARCHAR(20) NOT NULL PRIMARY KEY,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  },
};
