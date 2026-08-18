import type { Migration } from '../migrationRunner';

const sql = (strings: TemplateStringsArray): string => strings.join('');

export const migration004: Migration = {
  id: '004_dashboard_log_requests',
  up: async (conn) => {
    const statements = [
      sql`CREATE TABLE dashboard_log_requests (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        guild_id VARCHAR(20) NOT NULL,
        event VARCHAR(32) NOT NULL,
        actor_id VARCHAR(20) NULL,
        target_id VARCHAR(20) NULL,
        message TEXT NULL,
        details JSON NULL,
        status VARCHAR(12) NOT NULL DEFAULT 'pending',
        error TEXT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        processed_at DATETIME NULL,
        KEY idx_dlr_pending (status, created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    ];

    for (const statement of statements) {
      await conn.query(statement);
    }
  },
};
