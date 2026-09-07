import type { Migration } from '../migrationRunner';

const sql = (strings: TemplateStringsArray): string => strings.join('');

export const migration025: Migration = {
  id: '025_economy_core',
  up: async (conn) => {
    // Idempotent: IF NOT EXISTS + disable FK checks for partial-previous-run recovery
    await conn.query('SET FOREIGN_KEY_CHECKS = 0');
    const statements = [
      // ── Economy guild configuration ──────────────────────────────────────
      sql`CREATE TABLE IF NOT EXISTS economy_config (
        guild_id VARCHAR(20) PRIMARY KEY,
        enabled TINYINT(1) NOT NULL DEFAULT 0,
        settings JSON NOT NULL DEFAULT (JSON_OBJECT()),
        seed_version INT UNSIGNED NOT NULL DEFAULT 0,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

      // ── Per-user economy profile ─────────────────────────────────────────
      sql`CREATE TABLE IF NOT EXISTS economy_profiles (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        guild_id VARCHAR(20) NOT NULL,
        user_id VARCHAR(20) NOT NULL,
        wallet BIGINT UNSIGNED NOT NULL DEFAULT 0,
        bank BIGINT UNSIGNED NOT NULL DEFAULT 0,
        total_earned BIGINT UNSIGNED NOT NULL DEFAULT 0,
        total_spent BIGINT UNSIGNED NOT NULL DEFAULT 0,
        level INT UNSIGNED NOT NULL DEFAULT 1,
        xp BIGINT UNSIGNED NOT NULL DEFAULT 0,
        prestige INT UNSIGNED NOT NULL DEFAULT 0,
        job_id VARCHAR(64) NULL,
        job_level INT UNSIGNED NOT NULL DEFAULT 1,
        job_xp BIGINT UNSIGNED NOT NULL DEFAULT 0,
        daily_streak INT UNSIGNED NOT NULL DEFAULT 0,
        weekly_streak INT UNSIGNED NOT NULL DEFAULT 0,
        last_daily_at DATETIME NULL,
        last_weekly_at DATETIME NULL,
        last_work_at DATETIME NULL,
        status VARCHAR(16) NOT NULL DEFAULT 'active',
        opted_out TINYINT(1) NOT NULL DEFAULT 0,
        privacy_level VARCHAR(16) NOT NULL DEFAULT 'server',
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uq_eco_profile (guild_id, user_id),
        KEY idx_eco_profile_wallet (guild_id, wallet DESC),
        KEY idx_eco_profile_total_earned (guild_id, total_earned DESC),
        KEY idx_eco_profile_level (guild_id, level DESC, xp DESC),
        KEY idx_eco_profile_status (guild_id, status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

      // ── Immutable append-only ledger ─────────────────────────────────────
      sql`CREATE TABLE IF NOT EXISTS economy_ledger (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        tx_id VARCHAR(36) NOT NULL,
        guild_id VARCHAR(20) NOT NULL,
        actor_id VARCHAR(20) NOT NULL,
        target_id VARCHAR(20) NULL,
        tx_type VARCHAR(64) NOT NULL,
        amount BIGINT UNSIGNED NOT NULL DEFAULT 0,
        direction ENUM('credit', 'debit') NOT NULL,
        balance_after BIGINT UNSIGNED NOT NULL DEFAULT 0,
        ref_type VARCHAR(64) NULL,
        ref_id VARCHAR(64) NULL,
        idempotency_key VARCHAR(128) NULL,
        reason TEXT NULL,
        metadata JSON NULL,
        source VARCHAR(32) NOT NULL DEFAULT 'system',
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        UNIQUE KEY uq_ledger_tx_id (tx_id),
        KEY idx_ledger_guild_user (guild_id, target_id, created_at DESC),
        KEY idx_ledger_guild_type (guild_id, tx_type, created_at DESC),
        KEY idx_ledger_idempotency (idempotency_key),
        KEY idx_ledger_ref (ref_type, ref_id),
        KEY idx_ledger_actor (guild_id, actor_id, created_at DESC)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

      // ── Cooldowns (durable, restart-safe) ────────────────────────────────
      sql`CREATE TABLE IF NOT EXISTS economy_cooldowns (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        guild_id VARCHAR(20) NOT NULL,
        user_id VARCHAR(20) NOT NULL,
        bucket VARCHAR(64) NOT NULL,
        expires_at DATETIME NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_eco_cooldown (guild_id, user_id, bucket),
        KEY idx_eco_cooldown_expiry (expires_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

      // ── Daily/weekly streak tracking ─────────────────────────────────────
      sql`CREATE TABLE IF NOT EXISTS economy_streaks (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        guild_id VARCHAR(20) NOT NULL,
        user_id VARCHAR(20) NOT NULL,
        streak_type VARCHAR(32) NOT NULL,
        current_streak INT UNSIGNED NOT NULL DEFAULT 0,
        best_streak INT UNSIGNED NOT NULL DEFAULT 0,
        last_claim_at DATETIME NULL,
        grace_tokens INT UNSIGNED NOT NULL DEFAULT 0,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uq_eco_streak (guild_id, user_id, streak_type)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

      // ── Jobs ─────────────────────────────────────────────────────────────
      sql`CREATE TABLE IF NOT EXISTS economy_jobs (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        guild_id VARCHAR(20) NOT NULL,
        job_slug VARCHAR(64) NOT NULL,
        name VARCHAR(128) NOT NULL,
        description TEXT NULL,
        emoji VARCHAR(128) NULL,
        min_payout BIGINT UNSIGNED NOT NULL DEFAULT 0,
        max_payout BIGINT UNSIGNED NOT NULL DEFAULT 0,
        xp_reward INT UNSIGNED NOT NULL DEFAULT 0,
        cooldown_seconds INT UNSIGNED NOT NULL DEFAULT 60,
        required_level INT UNSIGNED NOT NULL DEFAULT 1,
        required_role_id VARCHAR(20) NULL,
        max_employees INT UNSIGNED NULL,
        enabled TINYINT(1) NOT NULL DEFAULT 1,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uq_eco_job (guild_id, job_slug),
        KEY idx_eco_job_enabled (guild_id, enabled)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

      // ── Item categories ──────────────────────────────────────────────────
      sql`CREATE TABLE IF NOT EXISTS economy_item_categories (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        guild_id VARCHAR(20) NOT NULL,
        slug VARCHAR(64) NOT NULL,
        name VARCHAR(128) NOT NULL,
        description TEXT NULL,
        emoji VARCHAR(128) NULL,
        sort_order INT NOT NULL DEFAULT 0,
        enabled TINYINT(1) NOT NULL DEFAULT 1,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_eco_cat (guild_id, slug),
        KEY idx_eco_cat_sort (guild_id, sort_order)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

      // ── Items ────────────────────────────────────────────────────────────
      sql`CREATE TABLE IF NOT EXISTS economy_items (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        guild_id VARCHAR(20) NOT NULL,
        item_slug VARCHAR(64) NOT NULL,
        name VARCHAR(128) NOT NULL,
        description TEXT NULL,
        emoji VARCHAR(128) NULL,
        category_slug VARCHAR(64) NULL,
        rarity VARCHAR(16) NOT NULL DEFAULT 'common',
        item_type VARCHAR(32) NOT NULL DEFAULT 'consumable',
        buy_price BIGINT UNSIGNED NOT NULL DEFAULT 0,
        sell_price BIGINT UNSIGNED NOT NULL DEFAULT 0,
        max_stack INT UNSIGNED NOT NULL DEFAULT 99,
        ownership_limit INT UNSIGNED NULL,
        allow_duplicate TINYINT(1) NOT NULL DEFAULT 0,
        tradable TINYINT(1) NOT NULL DEFAULT 1,
        sellable TINYINT(1) NOT NULL DEFAULT 1,
        giftable TINYINT(1) NOT NULL DEFAULT 1,
        stock INT UNSIGNED NULL,
        restock_amount INT UNSIGNED NULL,
        restock_interval_seconds INT UNSIGNED NULL,
        last_restock_at DATETIME NULL,
        per_user_purchase_limit INT UNSIGNED NULL,
        per_user_purchase_window_seconds INT UNSIGNED NULL,
        required_level INT UNSIGNED NOT NULL DEFAULT 0,
        required_role_id VARCHAR(20) NULL,
        required_item_slug VARCHAR(64) NULL,
        effect_type VARCHAR(64) NULL,
        effect_metadata JSON NULL,
        hidden TINYINT(1) NOT NULL DEFAULT 0,
        enabled TINYINT(1) NOT NULL DEFAULT 1,
        source VARCHAR(32) NOT NULL DEFAULT 'custom',
        tags JSON NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uq_eco_item (guild_id, item_slug),
        KEY idx_eco_item_cat (guild_id, category_slug),
        KEY idx_eco_item_rarity (guild_id, rarity),
        KEY idx_eco_item_enabled (guild_id, enabled)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

      // ── User inventories ─────────────────────────────────────────────────
      sql`CREATE TABLE IF NOT EXISTS economy_inventories (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        guild_id VARCHAR(20) NOT NULL,
        user_id VARCHAR(20) NOT NULL,
        item_id BIGINT UNSIGNED NOT NULL,
        quantity INT UNSIGNED NOT NULL DEFAULT 1,
        equipped TINYINT(1) NOT NULL DEFAULT 0,
        equipped_slot VARCHAR(32) NULL,
        acquired_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        source VARCHAR(32) NOT NULL DEFAULT 'shop',
        UNIQUE KEY uq_eco_inv (guild_id, user_id, item_id),
        KEY idx_eco_inv_user (guild_id, user_id),
        KEY idx_eco_inv_item (guild_id, item_id),
        CONSTRAINT fk_eco_inv_item FOREIGN KEY (item_id) REFERENCES economy_items(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

      // ── Active item effects ──────────────────────────────────────────────
      sql`CREATE TABLE IF NOT EXISTS economy_item_effects (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        guild_id VARCHAR(20) NOT NULL,
        user_id VARCHAR(20) NOT NULL,
        item_id BIGINT UNSIGNED NOT NULL,
        effect_type VARCHAR(64) NOT NULL,
        effect_data JSON NULL,
        expires_at DATETIME NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        KEY idx_eco_effects_user (guild_id, user_id),
        KEY idx_eco_effects_expiry (expires_at),
        KEY idx_eco_effects_type (guild_id, effect_type),
        CONSTRAINT fk_eco_effect_item FOREIGN KEY (item_id) REFERENCES economy_items(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

      // ── Shops ────────────────────────────────────────────────────────────
      sql`CREATE TABLE IF NOT EXISTS economy_shops (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        guild_id VARCHAR(20) NOT NULL,
        shop_slug VARCHAR(64) NOT NULL,
        name VARCHAR(128) NOT NULL,
        description TEXT NULL,
        emoji VARCHAR(128) NULL,
        sort_order INT NOT NULL DEFAULT 0,
        enabled TINYINT(1) NOT NULL DEFAULT 1,
        hidden TINYINT(1) NOT NULL DEFAULT 0,
        source VARCHAR(32) NOT NULL DEFAULT 'custom',
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uq_eco_shop (guild_id, shop_slug),
        KEY idx_eco_shop_sort (guild_id, sort_order)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

      // ── Shop listings (items assigned to shops) ──────────────────────────
      sql`CREATE TABLE IF NOT EXISTS economy_shop_listings (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        shop_id BIGINT UNSIGNED NOT NULL,
        item_id BIGINT UNSIGNED NOT NULL,
        override_price BIGINT UNSIGNED NULL,
        sort_order INT NOT NULL DEFAULT 0,
        enabled TINYINT(1) NOT NULL DEFAULT 1,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_eco_listing (shop_id, item_id),
        KEY idx_eco_listing_shop (shop_id, sort_order),
        CONSTRAINT fk_eco_listing_shop FOREIGN KEY (shop_id) REFERENCES economy_shops(id) ON DELETE CASCADE,
        CONSTRAINT fk_eco_listing_item FOREIGN KEY (item_id) REFERENCES economy_items(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

      // ── Payment requests ─────────────────────────────────────────────────
      sql`CREATE TABLE IF NOT EXISTS economy_payment_requests (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        guild_id VARCHAR(20) NOT NULL,
        from_user_id VARCHAR(20) NOT NULL,
        to_user_id VARCHAR(20) NOT NULL,
        amount BIGINT UNSIGNED NOT NULL,
        status VARCHAR(16) NOT NULL DEFAULT 'pending',
        reason TEXT NULL,
        idempotency_key VARCHAR(128) NULL,
        expires_at DATETIME NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uq_eco_pr_idemp (idempotency_key),
        KEY idx_eco_pr_to (guild_id, to_user_id, status),
        KEY idx_eco_pr_expiry (status, expires_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

      // ── Trades (multi-step state machine) ────────────────────────────────
      sql`CREATE TABLE IF NOT EXISTS economy_trades (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        guild_id VARCHAR(20) NOT NULL,
        initiator_id VARCHAR(20) NOT NULL,
        recipient_id VARCHAR(20) NOT NULL,
        status VARCHAR(16) NOT NULL DEFAULT 'draft',
        initiator_currency BIGINT UNSIGNED NOT NULL DEFAULT 0,
        recipient_currency BIGINT UNSIGNED NOT NULL DEFAULT 0,
        initiator_items JSON NULL,
        recipient_items JSON NULL,
        version INT UNSIGNED NOT NULL DEFAULT 1,
        confirmed_by JSON NULL DEFAULT (JSON_ARRAY()),
        expires_at DATETIME NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        KEY idx_eco_trade_init (guild_id, initiator_id, status),
        KEY idx_eco_trade_recip (guild_id, recipient_id, status),
        KEY idx_eco_trade_expiry (status, expires_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

      // ── Trade items (escrowed during active trades) ──────────────────────
      sql`CREATE TABLE IF NOT EXISTS economy_trade_items (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        trade_id BIGINT UNSIGNED NOT NULL,
        side ENUM('initiator', 'recipient') NOT NULL,
        inventory_id BIGINT UNSIGNED NOT NULL,
        quantity INT UNSIGNED NOT NULL DEFAULT 1,
        CONSTRAINT fk_eco_ti_trade FOREIGN KEY (trade_id) REFERENCES economy_trades(id) ON DELETE CASCADE,
        CONSTRAINT fk_eco_ti_inv FOREIGN KEY (inventory_id) REFERENCES economy_inventories(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

      // ── Marketplace listings ─────────────────────────────────────────────
      sql`CREATE TABLE IF NOT EXISTS economy_market_listings (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        guild_id VARCHAR(20) NOT NULL,
        seller_id VARCHAR(20) NOT NULL,
        item_id BIGINT UNSIGNED NOT NULL,
        quantity INT UNSIGNED NOT NULL DEFAULT 1,
        price_per_unit BIGINT UNSIGNED NOT NULL,
        status VARCHAR(16) NOT NULL DEFAULT 'active',
        buyer_id VARCHAR(20) NULL,
        listing_fee BIGINT UNSIGNED NOT NULL DEFAULT 0,
        tax_amount BIGINT UNSIGNED NOT NULL DEFAULT 0,
        escrow_inventory_id BIGINT UNSIGNED NULL,
        expires_at DATETIME NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        KEY idx_eco_market_active (guild_id, status, created_at DESC),
        KEY idx_eco_market_seller (guild_id, seller_id, status),
        KEY idx_eco_market_item (guild_id, item_id, status),
        KEY idx_eco_market_expiry (status, expires_at),
        CONSTRAINT fk_eco_market_item FOREIGN KEY (item_id) REFERENCES economy_items(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

      // ── Quests ───────────────────────────────────────────────────────────
      sql`CREATE TABLE IF NOT EXISTS economy_quests_templates (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        guild_id VARCHAR(20) NOT NULL,
        quest_slug VARCHAR(64) NOT NULL,
        name VARCHAR(128) NOT NULL,
        description TEXT NULL,
        emoji VARCHAR(128) NULL,
        quest_type VARCHAR(32) NOT NULL DEFAULT 'daily',
        requirements JSON NOT NULL DEFAULT (JSON_OBJECT()),
        reward_currency BIGINT UNSIGNED NOT NULL DEFAULT 0,
        reward_xp INT UNSIGNED NOT NULL DEFAULT 0,
        reward_items JSON NULL,
        required_level INT UNSIGNED NOT NULL DEFAULT 0,
        enabled TINYINT(1) NOT NULL DEFAULT 1,
        source VARCHAR(32) NOT NULL DEFAULT 'custom',
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_eco_quest (guild_id, quest_slug),
        KEY idx_eco_quest_type (guild_id, quest_type, enabled)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

      // ── User quest progress ──────────────────────────────────────────────
      sql`CREATE TABLE IF NOT EXISTS economy_quest_progress (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        guild_id VARCHAR(20) NOT NULL,
        user_id VARCHAR(20) NOT NULL,
        quest_id BIGINT UNSIGNED NOT NULL,
        progress JSON NOT NULL DEFAULT (JSON_OBJECT()),
        completed TINYINT(1) NOT NULL DEFAULT 0,
        claimed TINYINT(1) NOT NULL DEFAULT 0,
        started_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        completed_at DATETIME NULL,
        claimed_at DATETIME NULL,
        reset_at DATETIME NULL,
        UNIQUE KEY uq_eco_qp (guild_id, user_id, quest_id, reset_at),
        KEY idx_eco_qp_user (guild_id, user_id),
        CONSTRAINT fk_eco_qp_quest FOREIGN KEY (quest_id) REFERENCES economy_quest_templates(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

      // ── Achievements ─────────────────────────────────────────────────────
      sql`CREATE TABLE IF NOT EXISTS economy_achievements (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        guild_id VARCHAR(20) NOT NULL,
        achievement_slug VARCHAR(64) NOT NULL,
        name VARCHAR(128) NOT NULL,
        description TEXT NULL,
        emoji VARCHAR(128) NULL,
        category VARCHAR(64) NULL,
        points INT UNSIGNED NOT NULL DEFAULT 10,
        requirement_type VARCHAR(64) NOT NULL,
        requirement_value BIGINT UNSIGNED NOT NULL DEFAULT 0,
        reward_currency BIGINT UNSIGNED NOT NULL DEFAULT 0,
        reward_items JSON NULL,
        reward_role_id VARCHAR(20) NULL,
        hidden TINYINT(1) NOT NULL DEFAULT 0,
        enabled TINYINT(1) NOT NULL DEFAULT 1,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_eco_ach (guild_id, achievement_slug),
        KEY idx_eco_ach_cat (guild_id, category)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

      // ── User achievement unlocks ─────────────────────────────────────────
      sql`CREATE TABLE IF NOT EXISTS economy_achievement_unlocks (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        guild_id VARCHAR(20) NOT NULL,
        user_id VARCHAR(20) NOT NULL,
        achievement_id BIGINT UNSIGNED NOT NULL,
        unlocked_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_eco_ach_unlock (guild_id, user_id, achievement_id),
        KEY idx_eco_ach_user (guild_id, user_id),
        CONSTRAINT fk_eco_ach FOREIGN KEY (achievement_id) REFERENCES economy_achievements(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

      // ── Collections ──────────────────────────────────────────────────────
      sql`CREATE TABLE IF NOT EXISTS economy_collections (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        guild_id VARCHAR(20) NOT NULL,
        collection_slug VARCHAR(64) NOT NULL,
        name VARCHAR(128) NOT NULL,
        description TEXT NULL,
        emoji VARCHAR(128) NULL,
        required_items JSON NOT NULL DEFAULT (JSON_ARRAY()),
        reward_currency BIGINT UNSIGNED NOT NULL DEFAULT 0,
        reward_title VARCHAR(128) NULL,
        reward_badge VARCHAR(128) NULL,
        reward_role_id VARCHAR(20) NULL,
        enabled TINYINT(1) NOT NULL DEFAULT 1,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_eco_coll (guild_id, collection_slug)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

      // ── User collection progress ─────────────────────────────────────────
      sql`CREATE TABLE IF NOT EXISTS economy_collection_progress (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        guild_id VARCHAR(20) NOT NULL,
        user_id VARCHAR(20) NOT NULL,
        collection_id BIGINT UNSIGNED NOT NULL,
        completed TINYINT(1) NOT NULL DEFAULT 0,
        claimed TINYINT(1) NOT NULL DEFAULT 0,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        completed_at DATETIME NULL,
        UNIQUE KEY uq_eco_cp (guild_id, user_id, collection_id),
        CONSTRAINT fk_eco_cp_coll FOREIGN KEY (collection_id) REFERENCES economy_collections(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

      // ── Crafting recipes ─────────────────────────────────────────────────
      sql`CREATE TABLE IF NOT EXISTS economy_crafting_recipes (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        guild_id VARCHAR(20) NOT NULL,
        recipe_slug VARCHAR(64) NOT NULL,
        name VARCHAR(128) NOT NULL,
        description TEXT NULL,
        emoji VARCHAR(128) NULL,
        ingredients JSON NOT NULL DEFAULT (JSON_ARRAY()),
        result_item_slug VARCHAR(64) NOT NULL,
        result_quantity INT UNSIGNED NOT NULL DEFAULT 1,
        craft_time_seconds INT UNSIGNED NOT NULL DEFAULT 0,
        required_level INT UNSIGNED NOT NULL DEFAULT 0,
        enabled TINYINT(1) NOT NULL DEFAULT 1,
        source VARCHAR(32) NOT NULL DEFAULT 'custom',
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_eco_recipe (guild_id, recipe_slug),
        KEY idx_eco_recipe_enabled (guild_id, enabled)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

      // ── Role rewards ─────────────────────────────────────────────────────
      sql`CREATE TABLE IF NOT EXISTS economy_role_rewards (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        guild_id VARCHAR(20) NOT NULL,
        reward_slug VARCHAR(64) NOT NULL,
        name VARCHAR(128) NOT NULL,
        description TEXT NULL,
        emoji VARCHAR(128) NULL,
        discord_role_id VARCHAR(20) NOT NULL,
        reward_type VARCHAR(32) NOT NULL DEFAULT 'purchase',
        price BIGINT UNSIGNED NOT NULL DEFAULT 0,
        duration_seconds INT UNSIGNED NULL,
        renewal_price BIGINT UNSIGNED NULL,
        stock_limit INT UNSIGNED NULL,
        stock_remaining INT UNSIGNED NULL,
        required_level INT UNSIGNED NULL,
        required_achievement_slug VARCHAR(64) NULL,
        required_job_slug VARCHAR(64) NULL,
        required_prestige INT UNSIGNED NULL,
        mutually_exclusive_group VARCHAR(64) NULL,
        priority INT NOT NULL DEFAULT 0,
        refund_policy VARCHAR(16) NOT NULL DEFAULT 'none',
        removable TINYINT(1) NOT NULL DEFAULT 0,
        hidden TINYINT(1) NOT NULL DEFAULT 0,
        enabled TINYINT(1) NOT NULL DEFAULT 1,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uq_eco_role_reward (guild_id, reward_slug),
        KEY idx_eco_role_reward_enabled (guild_id, enabled)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

      // ── Active temporary role rewards ────────────────────────────────────
      sql`CREATE TABLE IF NOT EXISTS economy_role_reward_active (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        guild_id VARCHAR(20) NOT NULL,
        user_id VARCHAR(20) NOT NULL,
        reward_id BIGINT UNSIGNED NOT NULL,
        expires_at DATETIME NULL,
        granted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        removed_at DATETIME NULL,
        status VARCHAR(16) NOT NULL DEFAULT 'active',
        UNIQUE KEY uq_eco_rra (guild_id, user_id, reward_id),
        KEY idx_eco_rra_expiry (status, expires_at),
        KEY idx_eco_rra_user (guild_id, user_id),
        CONSTRAINT fk_eco_rra_reward FOREIGN KEY (reward_id) REFERENCES economy_role_rewards(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

      // ── Stealing attempt log ─────────────────────────────────────────────
      sql`CREATE TABLE IF NOT EXISTS economy_steal_log (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        guild_id VARCHAR(20) NOT NULL,
        attacker_id VARCHAR(20) NOT NULL,
        victim_id VARCHAR(20) NOT NULL,
        outcome VARCHAR(16) NOT NULL,
        amount_stolen BIGINT UNSIGNED NOT NULL DEFAULT 0,
        fine_amount BIGINT UNSIGNED NOT NULL DEFAULT 0,
        protection_used VARCHAR(64) NULL,
        idempotency_key VARCHAR(128) NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        KEY idx_eco_steal_attacker (guild_id, attacker_id, created_at DESC),
        KEY idx_eco_steal_victim (guild_id, victim_id, created_at DESC),
        KEY idx_eco_steal_idemp (idempotency_key)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

      // ── Leaderboard snapshots ────────────────────────────────────────────
      sql`CREATE TABLE IF NOT EXISTS economy_leaderboard_snapshots (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        guild_id VARCHAR(20) NOT NULL,
        category VARCHAR(64) NOT NULL,
        user_id VARCHAR(20) NOT NULL,
        value BIGINT UNSIGNED NOT NULL DEFAULT 0,
        rank_num INT UNSIGNED NOT NULL DEFAULT 0,
        snapshot_date DATE NOT NULL,
        snapshot_type VARCHAR(16) NOT NULL DEFAULT 'daily',
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_eco_lb_snap (guild_id, category, user_id, snapshot_date, snapshot_type),
        KEY idx_eco_lb_snap_cat (guild_id, category, snapshot_date, snapshot_type, value DESC)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

      // ── Economy admin adjustments (audit) ────────────────────────────────
      sql`CREATE TABLE IF NOT EXISTS economy_admin_adjustments (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        guild_id VARCHAR(20) NOT NULL,
        admin_id VARCHAR(20) NOT NULL,
        target_user_id VARCHAR(20) NOT NULL,
        adjustment_type VARCHAR(32) NOT NULL,
        amount BIGINT UNSIGNED NOT NULL DEFAULT 0,
        reason TEXT NOT NULL,
        tx_id VARCHAR(36) NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        KEY idx_eco_adj_guild (guild_id, created_at DESC),
        KEY idx_eco_adj_target (guild_id, target_user_id),
        KEY idx_eco_adj_admin (guild_id, admin_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

      // ── Economy notifications/inbox ──────────────────────────────────────
      sql`CREATE TABLE IF NOT EXISTS economy_notifications (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        guild_id VARCHAR(20) NOT NULL,
        user_id VARCHAR(20) NOT NULL,
        notification_type VARCHAR(64) NOT NULL,
        title VARCHAR(256) NOT NULL,
        body TEXT NULL,
        ref_type VARCHAR(64) NULL,
        ref_id VARCHAR(64) NULL,
        is_read TINYINT(1) NOT NULL DEFAULT 0,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        KEY idx_eco_notif_user (guild_id, user_id, is_read, created_at DESC)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

      // ── Economy statistics (aggregated snapshots) ────────────────────────
      sql`CREATE TABLE IF NOT EXISTS economy_statistics (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        guild_id VARCHAR(20) NOT NULL,
        stat_date DATE NOT NULL,
        total_supply BIGINT UNSIGNED NOT NULL DEFAULT 0,
        wallet_total BIGINT UNSIGNED NOT NULL DEFAULT 0,
        bank_total BIGINT UNSIGNED NOT NULL DEFAULT 0,
        active_users INT UNSIGNED NOT NULL DEFAULT 0,
        transactions_count INT UNSIGNED NOT NULL DEFAULT 0,
        commands_used INT UNSIGNED NOT NULL DEFAULT 0,
        items_circulating INT UNSIGNED NOT NULL DEFAULT 0,
        marketplace_volume BIGINT UNSIGNED NOT NULL DEFAULT 0,
        currency_earned BIGINT UNSIGNED NOT NULL DEFAULT 0,
        currency_spent BIGINT UNSIGNED NOT NULL DEFAULT 0,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_eco_stat (guild_id, stat_date),
        KEY idx_eco_stat_date (guild_id, stat_date DESC)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    ];

    for (const stmt of statements) {
      await conn.query(stmt);
    }
    await conn.query('SET FOREIGN_KEY_CHECKS = 1');
  },
};
