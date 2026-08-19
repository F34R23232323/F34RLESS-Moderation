import type { Migration } from '../migrationRunner';

const sql = (strings: TemplateStringsArray): string => strings.join('');

export const migration007: Migration = {
  id: '007_afk_mentions',
  up: async (conn) => {
    const statements = [
      sql`ALTER TABLE afk
          ADD COLUMN autoremove TINYINT(1) NOT NULL DEFAULT 1 AFTER reason`,

      sql`CREATE TABLE afk_mentions (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        guild_id VARCHAR(20) NOT NULL,
        user_id VARCHAR(20) NOT NULL,
        mentioner_id VARCHAR(20) NOT NULL,
        channel_id VARCHAR(20) NOT NULL,
        message_id VARCHAR(20) NOT NULL,
        cleared TINYINT(1) NOT NULL DEFAULT 0,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        KEY idx_am_user (guild_id, user_id, cleared)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    ];

    for (const statement of statements) {
      await conn.query(statement);
    }
  },
};
