import type { Migration } from '../migrationRunner';

const sql = (strings: TemplateStringsArray): string => strings.join('');

export const migration021: Migration = {
  id: '021_reply_ping_protection',
  up: async (conn) => {
    const statements = [
      sql`CREATE TABLE reply_ping_guild_config (
        guild_id VARCHAR(20) PRIMARY KEY,
        enabled TINYINT(1) NOT NULL DEFAULT 0,
        native_rule_id VARCHAR(20) NULL,
        notice_channel_id VARCHAR(20) NULL,
        log_channel_id VARCHAR(20) NULL,
        notice_title VARCHAR(255) NOT NULL DEFAULT 'Reply Mention Blocked',
        notice_description TEXT NULL,
        notice_accent_color VARCHAR(7) NOT NULL DEFAULT '#FEE75C',
        notice_delete_after_seconds INT UNSIGNED NOT NULL DEFAULT 0,
        escalation_enabled TINYINT(1) NOT NULL DEFAULT 1,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

      sql`CREATE TABLE reply_ping_protected_entities (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        guild_id VARCHAR(20) NOT NULL,
        entity_type ENUM('user', 'role') NOT NULL,
        entity_id VARCHAR(20) NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_reply_ping_protected (guild_id, entity_type, entity_id),
        KEY idx_reply_ping_protected_guild (guild_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

      sql`CREATE TABLE reply_ping_exemptions (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        guild_id VARCHAR(20) NOT NULL,
        entity_type ENUM('user', 'role', 'channel') NOT NULL,
        entity_id VARCHAR(20) NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_reply_ping_exemption (guild_id, entity_type, entity_id),
        KEY idx_reply_ping_exemptions_guild (guild_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

      sql`CREATE TABLE reply_ping_escalation_levels (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        guild_id VARCHAR(20) NOT NULL,
        level INT UNSIGNED NOT NULL DEFAULT 1,
        violation_count INT UNSIGNED NOT NULL,
        window_seconds INT UNSIGNED NOT NULL DEFAULT 3600,
        action_type ENUM('warn', 'mute', 'timeout', 'kick', 'ban') NOT NULL,
        action_duration VARCHAR(32) NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_reply_ping_escalation (guild_id, level),
        KEY idx_reply_ping_esc_guild (guild_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

      sql`CREATE TABLE reply_ping_incidents (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        guild_id VARCHAR(20) NOT NULL,
        user_id VARCHAR(20) NOT NULL,
        channel_id VARCHAR(20) NULL,
        message_id VARCHAR(20) NULL,
        original_content TEXT NULL,
        sanitized_content TEXT NULL,
        blocked_user_id VARCHAR(20) NULL,
        escalation_level INT UNSIGNED NOT NULL DEFAULT 0,
        action_taken VARCHAR(32) NULL,
        case_id BIGINT UNSIGNED NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        KEY idx_reply_ping_incidents_guild (guild_id, created_at),
        KEY idx_reply_ping_incidents_user (guild_id, user_id, created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

      sql`CREATE TABLE reply_ping_violation_counts (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        guild_id VARCHAR(20) NOT NULL,
        user_id VARCHAR(20) NOT NULL,
        window_start DATETIME NOT NULL,
        violation_count INT UNSIGNED NOT NULL DEFAULT 1,
        last_violation_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_reply_ping_vcount (guild_id, user_id, window_start),
        KEY idx_reply_ping_vcount_guild (guild_id, user_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    ];

    for (const statement of statements) {
      await conn.query(statement);
    }
  },
};
