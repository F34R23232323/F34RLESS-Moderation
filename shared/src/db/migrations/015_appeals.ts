import type { Migration } from '../migrationRunner';

// Appeals portal: the `appeals` table was created back in 001_initial as a
// minimal stub (case_id/guild_id/user_id/message/decision). This migration
// extends it with the columns the portal needs and adds the supporting
// guild-scoped tables:
//   - appeal_answers   : form answers per appeal (one row per question)
//   - appeal_blocks    : per-guild user blocks (expires_at NULL = permanent)
//   - appeal_messages  : the chat thread between the appellant and staff
//   - appeal_actions   : dashboard -> bot IPC queue (mirrors
//                        dashboard_log_requests; the bot polls pending rows)
//
// All tables carry guild_id and every query in the feature filters by it, even
// in single-guild deployments.
export const migration015: Migration = {
  id: '015_appeals',
  up: async (conn) => {
    // MySQL has no ADD COLUMN IF NOT EXISTS, so guard each ALTER with an
    // information_schema lookup — keeps the migration re-runnable on a half
    // migrated database (DDL commits implicitly in MySQL).
    const [cols] = await conn.query(
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'appeals'`,
    );
    const existing = new Set((cols as Array<{ COLUMN_NAME: string }>).map((c) => c.COLUMN_NAME));

    if (existing.has('status')) {
      // Only tighten to ENUM when no legacy rows hold unexpected statuses
      // (the legacy /appeal command only ever wrote 'pending').
      const [badStatuses] = await conn.query(
        "SELECT COUNT(*) AS count FROM appeals WHERE status NOT IN ('pending','accepted','denied','ignored')",
      );
      const badCount = Number((badStatuses as Array<{ count: number }>)[0]?.count ?? 0);
      if (badCount === 0) {
        await conn.query(
          `ALTER TABLE appeals MODIFY COLUMN status ENUM('pending','accepted','denied','ignored') NOT NULL DEFAULT 'pending'`,
        );
      }
    }

    const additions: Array<[string, string]> = [
      ['submitted_at', `DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP`],
      ['decision_reason', `TEXT NULL`],
      ['discord_message_id', `VARCHAR(20) NULL`],
      ['discord_thread_id', `VARCHAR(20) NULL`],
    ];
    for (const [name, def] of additions) {
      if (existing.has(name)) continue;
      await conn.query(`ALTER TABLE appeals ADD COLUMN ${name} ${def}`);
    }

    // Backfill submitted_at for rows created by the legacy /appeal command.
    await conn.query(`UPDATE appeals SET submitted_at = created_at WHERE submitted_at IS NULL`);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS appeal_answers (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        appeal_id BIGINT UNSIGNED NOT NULL,
        question_id VARCHAR(64) NOT NULL,
        answer_text TEXT NULL,
        answer_bool TINYINT(1) NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        KEY idx_appeal_answers_appeal (appeal_id),
        CONSTRAINT fk_appeal_answers_appeal FOREIGN KEY (appeal_id) REFERENCES appeals(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS appeal_blocks (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        guild_id VARCHAR(20) NOT NULL,
        user_id VARCHAR(20) NOT NULL,
        reason TEXT NOT NULL,
        blocked_by VARCHAR(20) NULL,
        blocked_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        expires_at DATETIME NULL,
        active TINYINT(1) NOT NULL DEFAULT 1,
        KEY idx_appeal_blocks_user (guild_id, user_id, active),
        KEY idx_appeal_blocks_active (guild_id, active, expires_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS appeal_messages (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        appeal_id BIGINT UNSIGNED NOT NULL,
        sender_type ENUM('user','staff') NOT NULL,
        sender_id VARCHAR(20) NOT NULL,
        content TEXT NOT NULL,
        sent_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        KEY idx_appeal_messages_appeal (appeal_id, id),
        CONSTRAINT fk_appeal_messages_appeal FOREIGN KEY (appeal_id) REFERENCES appeals(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // Dashboard -> bot IPC queue (same pattern as dashboard_log_requests).
    await conn.query(`
      CREATE TABLE IF NOT EXISTS appeal_actions (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        guild_id VARCHAR(20) NOT NULL,
        appeal_id BIGINT UNSIGNED NULL,
        action VARCHAR(24) NOT NULL,
        payload JSON NULL,
        status VARCHAR(12) NOT NULL DEFAULT 'pending',
        error TEXT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        processed_at DATETIME NULL,
        KEY idx_appeal_actions_pending (status, id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  },
};
