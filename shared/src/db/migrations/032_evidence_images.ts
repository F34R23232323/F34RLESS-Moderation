import type { Migration } from '../migrationRunner';

const sql = (strings: TemplateStringsArray): string => strings.join('');

export const migration032: Migration = {
  id: '032_evidence_images',
  up: async (conn) => {
    const statements = [
      sql`CREATE TABLE IF NOT EXISTS evidence_images (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        code VARCHAR(32) NOT NULL,
        guild_id VARCHAR(20) NOT NULL,
        channel_id VARCHAR(20) NULL,
        name VARCHAR(255) NULL,
        content_type VARCHAR(64) NOT NULL,
        size INT NOT NULL,
        original_url TEXT NULL,
        uploaded_by VARCHAR(20) NULL,
        data LONGBLOB NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uq_evidence_images_code (code)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    ];

    for (const statement of statements) {
      await conn.query(statement);
    }
  },
};
