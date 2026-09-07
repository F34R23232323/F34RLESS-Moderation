import type { Migration } from '../migrationRunner';

export const migration022: Migration = {
  id: '022_antinuke',
  up: async (conn) => {
    const statements = [
      `CREATE TABLE antinuke_configs (
        guild_id VARCHAR(20) PRIMARY KEY, version BIGINT UNSIGNED NOT NULL DEFAULT 1,
        schema_version INT UNSIGNED NOT NULL DEFAULT 1, enabled TINYINT(1) NOT NULL DEFAULT 0,
        setup_completed_at DATETIME(3) NULL, config_json JSON NOT NULL,
        updated_by VARCHAR(20) NOT NULL, created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
        KEY idx_antinuke_configs_enabled (enabled)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
      `CREATE TABLE antinuke_protections (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, guild_id VARCHAR(20) NOT NULL,
        protection_type VARCHAR(64) NOT NULL, enabled TINYINT(1) NOT NULL DEFAULT 1,
        policy_json JSON NOT NULL, config_version BIGINT UNSIGNED NOT NULL,
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
        UNIQUE KEY uq_antinuke_protection (guild_id, protection_type), KEY idx_antinuke_protection_guild (guild_id, enabled)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
      `CREATE TABLE antinuke_owners (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, guild_id VARCHAR(20) NOT NULL, user_id VARCHAR(20) NOT NULL,
        added_by VARCHAR(20) NOT NULL, created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), revoked_at DATETIME(3) NULL, revoked_by VARCHAR(20) NULL,
        UNIQUE KEY uq_antinuke_owner (guild_id, user_id), KEY idx_antinuke_owner_active (guild_id, revoked_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
      `CREATE TABLE antinuke_whitelist_entries (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, guild_id VARCHAR(20) NOT NULL, entity_type VARCHAR(24) NOT NULL,
        entity_id VARCHAR(20) NOT NULL, scopes_json JSON NOT NULL, reason VARCHAR(500) NOT NULL,
        added_by VARCHAR(20) NOT NULL, expires_at DATETIME(3) NULL, deleted_at DATETIME(3) NULL, deleted_by VARCHAR(20) NULL,
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        UNIQUE KEY uq_antinuke_whitelist (guild_id, entity_type, entity_id), KEY idx_antinuke_whitelist_expiry (guild_id, expires_at, deleted_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
      `CREATE TABLE antinuke_trusted_apps (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, guild_id VARCHAR(20) NOT NULL, entity_type VARCHAR(24) NOT NULL,
        entity_id VARCHAR(20) NOT NULL, action_scopes_json JSON NOT NULL, reason VARCHAR(500) NOT NULL,
        approved_by VARCHAR(20) NOT NULL, expires_at DATETIME(3) NULL, deleted_at DATETIME(3) NULL,
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        UNIQUE KEY uq_antinuke_trusted_app (guild_id, entity_type, entity_id), KEY idx_antinuke_trusted_app_expiry (guild_id, expires_at, deleted_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
      `CREATE TABLE antinuke_incidents (
        id CHAR(36) PRIMARY KEY, guild_id VARCHAR(20) NOT NULL, executor_id VARCHAR(20) NULL, status VARCHAR(32) NOT NULL,
        severity INT UNSIGNED NOT NULL DEFAULT 0, risk_score INT UNSIGNED NOT NULL DEFAULT 0, correlation_id CHAR(36) NOT NULL,
        config_version BIGINT UNSIGNED NOT NULL, opened_at DATETIME(3) NOT NULL, closed_at DATETIME(3) NULL,
        handled_at DATETIME(3) NULL, handled_by VARCHAR(20) NULL,
        UNIQUE KEY uq_antinuke_incident_correlation (guild_id, correlation_id), KEY idx_antinuke_incident_status (guild_id, status, opened_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
      `CREATE TABLE antinuke_incident_events (
        id CHAR(36) PRIMARY KEY, incident_id CHAR(36) NULL, guild_id VARCHAR(20) NOT NULL, event_type VARCHAR(64) NOT NULL,
        target_type VARCHAR(32) NOT NULL, target_id VARCHAR(20) NOT NULL, executor_id VARCHAR(20) NULL,
        attribution_status VARCHAR(24) NOT NULL, confidence INT UNSIGNED NOT NULL DEFAULT 0, audit_entry_id VARCHAR(20) NULL,
        observed_at DATETIME(3) NOT NULL, evidence_json JSON NOT NULL, shard_id INT NULL, instance_id VARCHAR(128) NOT NULL, correlation_id CHAR(36) NOT NULL,
        UNIQUE KEY uq_antinuke_event (guild_id, id), KEY idx_antinuke_event_lookup (guild_id, event_type, observed_at), KEY idx_antinuke_event_audit (guild_id, audit_entry_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
      `CREATE TABLE antinuke_external_app_cases (
        id CHAR(36) PRIMARY KEY, guild_id VARCHAR(20) NOT NULL, member_id VARCHAR(20) NULL, application_id VARCHAR(20) NULL,
        bot_user_id VARCHAR(20) NULL, integration_id VARCHAR(20) NULL, webhook_id VARCHAR(20) NULL,
        status VARCHAR(48) NOT NULL, classification VARCHAR(32) NOT NULL, evidence_version INT UNSIGNED NOT NULL DEFAULT 1,
        audit_entry_id VARCHAR(20) NULL, confidence INT UNSIGNED NOT NULL DEFAULT 0, rule_id VARCHAR(64) NOT NULL,
        evidence_json JSON NOT NULL, review_message_id VARCHAR(20) NULL, reviewer_id VARCHAR(20) NULL, review_reason VARCHAR(1000) NULL,
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3), closed_at DATETIME(3) NULL,
        KEY idx_antinuke_app_case_status (guild_id, status, created_at), KEY idx_antinuke_app_case_member (guild_id, member_id, status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
      `CREATE TABLE antinuke_enforcement_actions (
        id CHAR(36) PRIMARY KEY, incident_id CHAR(36) NULL, case_id CHAR(36) NULL, guild_id VARCHAR(20) NOT NULL,
        target_id VARCHAR(20) NOT NULL, action_type VARCHAR(32) NOT NULL, status VARCHAR(24) NOT NULL,
        idempotency_key VARCHAR(190) NOT NULL, requested_at DATETIME(3) NOT NULL, completed_at DATETIME(3) NULL,
        result_json JSON NOT NULL, error_text VARCHAR(1000) NULL,
        UNIQUE KEY uq_antinuke_enforcement_key (idempotency_key), KEY idx_antinuke_enforcement_target (guild_id, target_id, requested_at),
        UNIQUE KEY uq_antinuke_active_case_action (case_id, target_id, action_type)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
      `CREATE TABLE antinuke_role_snapshots (
        id CHAR(36) PRIMARY KEY, guild_id VARCHAR(20) NOT NULL, incident_id CHAR(36) NULL, case_id CHAR(36) NULL,
        member_id VARCHAR(20) NOT NULL, roles_json JSON NOT NULL, created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        KEY idx_antinuke_role_snapshot (guild_id, member_id, created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
      `CREATE TABLE antinuke_resource_snapshots (
        id CHAR(36) PRIMARY KEY, guild_id VARCHAR(20) NOT NULL, incident_id CHAR(36) NULL, resource_type VARCHAR(32) NOT NULL,
        resource_id VARCHAR(20) NOT NULL, snapshot_json JSON NOT NULL, created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        KEY idx_antinuke_resource_snapshot (guild_id, resource_type, resource_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
      `CREATE TABLE antinuke_maintenance_sessions (
        id CHAR(36) PRIMARY KEY, guild_id VARCHAR(20) NOT NULL, owner_id VARCHAR(20) NOT NULL, reason VARCHAR(500) NOT NULL,
        scopes_json JSON NOT NULL, starts_at DATETIME(3) NOT NULL, expires_at DATETIME(3) NOT NULL, stopped_at DATETIME(3) NULL, stopped_by VARCHAR(20) NULL,
        KEY idx_antinuke_maintenance_active (guild_id, expires_at, stopped_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
      `CREATE TABLE antinuke_night_schedules (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, guild_id VARCHAR(20) NOT NULL, timezone VARCHAR(64) NOT NULL,
        start_time CHAR(5) NOT NULL, end_time CHAR(5) NOT NULL, weekdays_json JSON NOT NULL, enabled TINYINT(1) NOT NULL DEFAULT 0,
        expires_at DATETIME(3) NULL, updated_by VARCHAR(20) NOT NULL, updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
        UNIQUE KEY uq_antinuke_night_schedule (guild_id), KEY idx_antinuke_night_enabled (enabled, expires_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
      `CREATE TABLE antinuke_config_history (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, guild_id VARCHAR(20) NOT NULL, version BIGINT UNSIGNED NOT NULL,
        actor_id VARCHAR(20) NOT NULL, action VARCHAR(64) NOT NULL, previous_json JSON NULL, next_json JSON NOT NULL,
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        UNIQUE KEY uq_antinuke_config_version (guild_id, version), KEY idx_antinuke_config_history (guild_id, created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
      `CREATE TABLE antinuke_processed_audit_entries (
        guild_id VARCHAR(20) NOT NULL, audit_entry_id VARCHAR(20) NOT NULL, event_id CHAR(36) NOT NULL,
        event_type VARCHAR(64) NOT NULL, processed_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        PRIMARY KEY (guild_id, audit_entry_id), UNIQUE KEY uq_antinuke_audit_event (guild_id, event_id), KEY idx_antinuke_audit_processed (guild_id, processed_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
      `CREATE TABLE antinuke_case_transitions (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, case_id CHAR(36) NOT NULL, guild_id VARCHAR(20) NOT NULL,
        actor_id VARCHAR(20) NOT NULL, previous_status VARCHAR(48) NOT NULL, next_status VARCHAR(48) NOT NULL,
        reason VARCHAR(1000) NOT NULL, evidence_version INT UNSIGNED NOT NULL, created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        KEY idx_antinuke_case_transition (case_id, created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
      `CREATE TABLE antinuke_notifications (
        id CHAR(36) PRIMARY KEY, guild_id VARCHAR(20) NOT NULL, incident_id CHAR(36) NULL, case_id CHAR(36) NULL,
        notification_kind VARCHAR(32) NOT NULL, escalation_level INT UNSIGNED NOT NULL DEFAULT 0, status VARCHAR(24) NOT NULL,
        destination_id VARCHAR(20) NULL, attempts INT UNSIGNED NOT NULL DEFAULT 0, last_error VARCHAR(1000) NULL,
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), sent_at DATETIME(3) NULL,
        UNIQUE KEY uq_antinuke_notification (case_id, notification_kind, escalation_level), KEY idx_antinuke_notification_pending (status, created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
      `CREATE TABLE antinuke_recovery_jobs (
        id CHAR(36) PRIMARY KEY, guild_id VARCHAR(20) NOT NULL, incident_id CHAR(36) NOT NULL, requested_by VARCHAR(20) NOT NULL,
        status VARCHAR(24) NOT NULL, plan_json JSON NOT NULL, progress_json JSON NOT NULL, cancel_requested TINYINT(1) NOT NULL DEFAULT 0,
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
        KEY idx_antinuke_recovery_status (guild_id, status, created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
      `CREATE TABLE antinuke_setup_sessions (
        id CHAR(36) PRIMARY KEY, guild_id VARCHAR(20) NOT NULL, owner_id VARCHAR(20) NOT NULL, step VARCHAR(48) NOT NULL,
        state_json JSON NOT NULL, payload_hash CHAR(64) NOT NULL, expires_at DATETIME(3) NOT NULL, consumed_at DATETIME(3) NULL,
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        KEY idx_antinuke_setup_session (guild_id, owner_id, expires_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
      `CREATE TABLE antinuke_app_rules (
        id VARCHAR(64) NOT NULL, guild_id VARCHAR(20) NOT NULL, enabled TINYINT(1) NOT NULL DEFAULT 0,
        configuration_json JSON NOT NULL, updated_by VARCHAR(20) NOT NULL, updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
        PRIMARY KEY (guild_id, id), KEY idx_antinuke_app_rule_enabled (guild_id, enabled)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
      `CREATE TABLE antinuke_case_notes (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, case_id CHAR(36) NOT NULL, guild_id VARCHAR(20) NOT NULL,
        actor_id VARCHAR(20) NOT NULL, note VARCHAR(2000) NOT NULL, created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        KEY idx_antinuke_case_note (case_id, created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
      `CREATE TABLE antinuke_appeals (
        id CHAR(36) PRIMARY KEY, case_id CHAR(36) NOT NULL, guild_id VARCHAR(20) NOT NULL, member_id VARCHAR(20) NOT NULL,
        message VARCHAR(2000) NOT NULL, status VARCHAR(24) NOT NULL DEFAULT 'open', created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), reviewed_at DATETIME(3) NULL,
        KEY idx_antinuke_appeal_case (guild_id, case_id, status), KEY idx_antinuke_appeal_member (guild_id, member_id, created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    ];
    for (const statement of statements) await conn.query(statement);
  },
};
