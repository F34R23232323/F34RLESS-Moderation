import type { Migration } from '../migrationRunner';

const sql = (strings: TemplateStringsArray): string => strings.join('');

/**
 * GDPR compliance: user privacy preferences and rate-limited export/delete.
 * Any Discord user can access the GDPR page — not just the dashboard owner.
 */
export const migration017: Migration = {
  id: '017_user_privacy',
  up: async (conn) => {
    const statements = [
      sql`CREATE TABLE user_privacy (
        user_id VARCHAR(20) NOT NULL,
        opt_out_snapshots TINYINT(1) NOT NULL DEFAULT 0,
        opt_out_automod_log TINYINT(1) NOT NULL DEFAULT 0,
        opt_out_report_target TINYINT(1) NOT NULL DEFAULT 0,
        export_last_at DATETIME NULL,
        delete_last_at DATETIME NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (user_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    ];

    for (const statement of statements) {
      await conn.query(statement);
    }
  },
};