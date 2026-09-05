import type { Migration } from '../migrationRunner';

const sql = (strings: TemplateStringsArray): string => strings.join('');

// External-bot API. The dashboard server accepts authenticated requests from
// other bots. Punishments that should perform a native Discord action are
// queued in `api_case_requests` and executed by the bot's ApiCaseService; every
// request (queued or log-only) is also recorded in `api_request_logs` for audit.
export const migration020: Migration = {
  id: '020_api_case_requests',
  up: async (conn) => {
    const statements = [
      sql`CREATE TABLE api_request_logs (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        source VARCHAR(64) NOT NULL,
        guild_id VARCHAR(20) NOT NULL,
        method VARCHAR(8) NOT NULL,
        path VARCHAR(255) NOT NULL,
        status_code INT UNSIGNED NOT NULL,
        ip VARCHAR(64) NULL,
        payload JSON NULL,
        response JSON NULL,
        error VARCHAR(1000) NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        KEY idx_api_logs_source (source, created_at),
        KEY idx_api_logs_guild (guild_id, created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

      sql`CREATE TABLE api_case_requests (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        source VARCHAR(64) NOT NULL,
        guild_id VARCHAR(20) NOT NULL,
        type VARCHAR(32) NOT NULL,
        user_id VARCHAR(20) NOT NULL,
        moderator_id VARCHAR(20) NULL,
        reason TEXT NOT NULL,
        duration_ms BIGINT NULL,
        delete_message_days INT UNSIGNED NULL,
        evidence JSON NULL,
        action TINYINT(1) NOT NULL DEFAULT 1,
        status VARCHAR(16) NOT NULL DEFAULT 'pending',
        case_id BIGINT UNSIGNED NULL,
        error VARCHAR(1000) NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        processed_at DATETIME NULL,
        KEY idx_api_cases_status (status, created_at),
        KEY idx_api_cases_guild (guild_id, created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    ];

    for (const statement of statements) {
      await conn.query(statement);
    }
  },
};
