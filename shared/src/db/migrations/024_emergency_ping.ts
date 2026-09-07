import type { Migration } from '../migrationRunner';

export const migration024: Migration = {
  id: '024_emergency_ping',
  up: async (conn) => {
    const statements = [
      `CREATE TABLE emergency_ping_usage (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        guild_id VARCHAR(20) NOT NULL,
        user_id VARCHAR(20) NOT NULL,
        channel_id VARCHAR(20) NOT NULL,
        reason TEXT NOT NULL,
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        KEY idx_eping_guild_user (guild_id, user_id, created_at),
        KEY idx_eping_guild_time (guild_id, created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
      `CREATE TABLE emergency_ping_access (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        guild_id VARCHAR(20) NOT NULL,
        user_id VARCHAR(20) NOT NULL,
        status ENUM('granted', 'revoked') NOT NULL DEFAULT 'granted',
        granted_by VARCHAR(20) NULL,
        revoked_by VARCHAR(20) NULL,
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        UNIQUE KEY uq_eping_access (guild_id, user_id),
        KEY idx_eping_access_guild (guild_id, status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    ];
    for (const stmt of statements) await conn.query(stmt);
  },
};
