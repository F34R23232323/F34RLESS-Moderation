import type { Migration } from '../migrationRunner';

export const migration023: Migration = {
  id: '023_scam_image_hashes',
  up: async (conn) => {
    await conn.query(`
      CREATE TABLE scam_image_hashes (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        hash CHAR(16) NOT NULL,
        description VARCHAR(256) NOT NULL DEFAULT '',
        added_by VARCHAR(20) NOT NULL,
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        UNIQUE KEY uq_scam_hash (hash),
        KEY idx_scam_hash_lookup (hash)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  },
};
