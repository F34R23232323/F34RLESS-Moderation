import type { Migration } from '../migrationRunner';

const sql = (strings: TemplateStringsArray): string => strings.join('');

export const migration009: Migration = {
  id: '009_custom_command_counters',
  up: async (conn) => {
    const statements = [
      sql`CREATE TABLE IF NOT EXISTS custom_command_counters (
        guild_id VARCHAR(20) NOT NULL,
        name VARCHAR(64) NOT NULL,
        value BIGINT NOT NULL DEFAULT 0,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (guild_id, name)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    ];

    for (const statement of statements) {
      await conn.query(statement);
    }
  },
};