import type { Migration } from '../migrationRunner';

const sql = (strings: TemplateStringsArray): string => strings.join('');

export const migration026: Migration = {
  id: '026_economy_extended',
  up: async (conn) => {
    await conn.query('SET FOREIGN_KEY_CHECKS = 0');
    const statements = [
      // ── Gifts ────────────────────────────────────────────────────────────
      sql`CREATE TABLE IF NOT EXISTS economy_gifts (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        guild_id VARCHAR(20) NOT NULL,
        sender_id VARCHAR(20) NOT NULL,
        recipient_id VARCHAR(20) NOT NULL,
        item_id BIGINT UNSIGNED NULL,
        currency_amount BIGINT UNSIGNED NOT NULL DEFAULT 0,
        quantity INT UNSIGNED NOT NULL DEFAULT 1,
        note TEXT NULL,
        status VARCHAR(16) NOT NULL DEFAULT 'pending',
        expires_at DATETIME NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        claimed_at DATETIME NULL,
        KEY idx_eco_gift_recip (guild_id, recipient_id, status),
        KEY idx_eco_gift_sender (guild_id, sender_id),
        KEY idx_eco_gift_expiry (status, expires_at),
        CONSTRAINT fk_eco_gift_item FOREIGN KEY (item_id) REFERENCES economy_items(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

      // ── Economy bans ─────────────────────────────────────────────────────
      sql`CREATE TABLE IF NOT EXISTS economy_bans (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        guild_id VARCHAR(20) NOT NULL,
        user_id VARCHAR(20) NOT NULL,
        reason TEXT NOT NULL,
        banned_by VARCHAR(20) NOT NULL,
        expires_at DATETIME NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_eco_ban (guild_id, user_id),
        KEY idx_eco_ban_expiry (guild_id, expires_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

      // ── Transactions log for reversal tracking ───────────────────────────
      sql`CREATE TABLE IF NOT EXISTS economy_reversals (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        guild_id VARCHAR(20) NOT NULL,
        original_tx_id VARCHAR(36) NOT NULL,
        reversal_tx_id VARCHAR(36) NOT NULL,
        admin_id VARCHAR(20) NOT NULL,
        confirming_admin_id VARCHAR(20) NULL,
        reason TEXT NOT NULL,
        status VARCHAR(16) NOT NULL DEFAULT 'pending',
        confirmation_token VARCHAR(128) NULL,
        token_expires_at DATETIME NULL,
        plan_hash VARCHAR(64) NULL,
        compensation JSON NULL,
        conflicts JSON NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        completed_at DATETIME NULL,
        UNIQUE KEY uq_eco_rev_token (confirmation_token),
        KEY idx_eco_rev_original (guild_id, original_tx_id),
        KEY idx_eco_rev_status (guild_id, status),
        KEY idx_eco_rev_admin (guild_id, admin_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

      // ── Prestige/rebirth history ─────────────────────────────────────────
      sql`CREATE TABLE IF NOT EXISTS economy_prestige_history (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        guild_id VARCHAR(20) NOT NULL,
        user_id VARCHAR(20) NOT NULL,
        prestige_level INT UNSIGNED NOT NULL,
        reset_level BIGINT UNSIGNED NOT NULL DEFAULT 0,
        total_earned_at_reset BIGINT UNSIGNED NOT NULL DEFAULT 0,
        reset_fields JSON NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        KEY idx_eco_prestige_user (guild_id, user_id),
        KEY idx_eco_prestige_level (guild_id, prestige_level DESC)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

      // ── Scheduled role expiry queue (for background processing) ──────────
      sql`CREATE TABLE IF NOT EXISTS economy_role_expiry_queue (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        guild_id VARCHAR(20) NOT NULL,
        user_id VARCHAR(20) NOT NULL,
        discord_role_id VARCHAR(20) NOT NULL,
        active_record_id BIGINT UNSIGNED NOT NULL,
        expires_at DATETIME NOT NULL,
        processed TINYINT(1) NOT NULL DEFAULT 0,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        KEY idx_eco_rq_pending (processed, expires_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    ];

    for (const stmt of statements) {
      await conn.query(stmt);
    }
    await conn.query('SET FOREIGN_KEY_CHECKS = 1');
  },
};
