import type { Migration } from '../migrationRunner';

export const migration005: Migration = {
  id: '005_guild_roles',
  up: async (conn) => {
    await conn.query(`CREATE TABLE IF NOT EXISTS guild_roles (
      id VARCHAR(20) PRIMARY KEY,
      guild_id VARCHAR(20) NOT NULL,
      name VARCHAR(120) NOT NULL,
      color INT NOT NULL DEFAULT 0,
      position INT NOT NULL DEFAULT 0,
      hoist TINYINT(1) NOT NULL DEFAULT 0,
      managed TINYINT(1) NOT NULL DEFAULT 0,
      KEY idx_gr_guild (guild_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
  },
};