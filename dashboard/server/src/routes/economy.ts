import { Router } from 'express';
import type { RowDataPacket } from 'mysql2/promise';
import type { DashboardContext } from '../context';

export function createEconomyRouter(ctx: DashboardContext): Router {
  const router = Router();

  // ── Overview ─────────────────────────────────────────────────────────
  router.get('/overview', async (req, res) => {
    const guildId = req.query.guild_id as string;
    if (!guildId) { res.status(400).json({ error: 'guild_id required' }); return; }

    try {
      const [config] = await ctx.db.query<RowDataPacket[]>(
        'SELECT * FROM economy_config WHERE guild_id = ?', [guildId],
      );
      const enabled = (config[0] as any)?.enabled ?? false;

      const [stats] = await ctx.db.query<RowDataPacket[]>(
        `SELECT
          COALESCE(SUM(wallet + bank), 0) as total_supply,
          COALESCE(SUM(wallet), 0) as wallet_total,
          COALESCE(SUM(bank), 0) as bank_total,
          COUNT(*) as active_users
         FROM economy_profiles WHERE guild_id = ? AND status = 'active'`,
        [guildId],
      );

      const [txStats] = await ctx.db.query<RowDataPacket[]>(
        `SELECT COUNT(*) as tx_count, COALESCE(SUM(amount), 0) as total_volume
         FROM economy_ledger WHERE guild_id = ? AND created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)`,
        [guildId],
      );

      res.json({
        enabled,
        config: config[0] ?? null,
        stats: stats[0] ?? { total_supply: 0, wallet_total: 0, bank_total: 0, active_users: 0 },
        recent_activity: txStats[0] ?? { tx_count: 0, total_volume: 0 },
      });
    } catch (err) {
      res.status(500).json({ error: 'Failed to load economy overview' });
    }
  });

  // ── Shops ────────────────────────────────────────────────────────────
  router.get('/shops', async (req, res) => {
    const guildId = req.query.guild_id as string;
    if (!guildId) { res.status(400).json({ error: 'guild_id required' }); return; }

    const [shops] = await ctx.db.query<RowDataPacket[]>(
      'SELECT * FROM economy_shops WHERE guild_id = ? ORDER BY sort_order',
      [guildId],
    );
    res.json({ shops });
  });

  router.get('/shops/:id/items', async (req, res) => {
    const shopId = req.params.id;
    const [items] = await ctx.db.query<RowDataPacket[]>(
      `SELECT sl.*, ei.*
       FROM economy_shop_listings sl
       JOIN economy_items ei ON sl.item_id = ei.id
       WHERE sl.shop_id = ?
       ORDER BY sl.sort_order, ei.name`,
      [shopId],
    );
    res.json({ items });
  });

  router.post('/shops', async (req, res) => {
    const { guild_id, slug, name, description, emoji } = req.body;
    if (!guild_id || !slug || !name) { res.status(400).json({ error: 'guild_id, slug, name required' }); return; }

    try {
      await ctx.db.execute(
        'INSERT INTO economy_shops (guild_id, shop_slug, name, description, emoji) VALUES (?, ?, ?, ?, ?)',
        [guild_id, slug, name, description ?? null, emoji ?? null],
      );
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: 'Failed to create shop' });
    }
  });

  router.put('/shops/:id', async (req, res) => {
    const { name, description, emoji, enabled, sort_order } = req.body;
    try {
      const sets: string[] = [];
      const params: unknown[] = [];
      if (name !== undefined) { sets.push('name = ?'); params.push(name); }
      if (description !== undefined) { sets.push('description = ?'); params.push(description); }
      if (emoji !== undefined) { sets.push('emoji = ?'); params.push(emoji); }
      if (enabled !== undefined) { sets.push('enabled = ?'); params.push(enabled ? 1 : 0); }
      if (sort_order !== undefined) { sets.push('sort_order = ?'); params.push(sort_order); }
      if (sets.length === 0) { res.status(400).json({ error: 'No fields to update' }); return; }
      params.push(req.params.id);
      await ctx.db.execute(`UPDATE economy_shops SET ${sets.join(', ')} WHERE id = ?`, params as any);
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: 'Failed to update shop' });
    }
  });

  // ── Items ────────────────────────────────────────────────────────────
  router.get('/items', async (req, res) => {
    const guildId = req.query.guild_id as string;
    if (!guildId) { res.status(400).json({ error: 'guild_id required' }); return; }

    let sql = 'SELECT * FROM economy_items WHERE guild_id = ?';
    const params: unknown[] = [guildId];
    if (req.query.category) { sql += ' AND category_slug = ?'; params.push(req.query.category); }
    if (req.query.rarity) { sql += ' AND rarity = ?'; params.push(req.query.rarity); }
    sql += ' ORDER BY name';
    const [items] = await ctx.db.query<RowDataPacket[]>(sql, params);
    res.json({ items });
  });

  router.post('/items', async (req, res) => {
    const { guild_id, item_slug, name, description, emoji, category_slug, rarity, item_type, buy_price, sell_price } = req.body;
    if (!guild_id || !item_slug || !name) { res.status(400).json({ error: 'guild_id, item_slug, name required' }); return; }

    try {
      await ctx.db.execute(
        `INSERT INTO economy_items (guild_id, item_slug, name, description, emoji, category_slug, rarity, item_type, buy_price, sell_price)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [guild_id, item_slug, name, description ?? null, emoji ?? null, category_slug ?? null, rarity ?? 'common', item_type ?? 'consumable', buy_price ?? 0, sell_price ?? 0],
      );
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: 'Failed to create item' });
    }
  });

  // ── Users ────────────────────────────────────────────────────────────
  router.get('/users', async (req, res) => {
    const guildId = req.query.guild_id as string;
    if (!guildId) { res.status(400).json({ error: 'guild_id required' }); return; }

    const [users] = await ctx.db.query<RowDataPacket[]>(
      `SELECT * FROM economy_profiles WHERE guild_id = ? ORDER BY (wallet + bank) DESC LIMIT 100`,
      [guildId],
    );
    res.json({ users });
  });

  router.get('/users/:userId', async (req, res) => {
    const { userId } = req.params;
    const guildId = req.query.guild_id as string;
    if (!guildId) { res.status(400).json({ error: 'guild_id required' }); return; }

    const [profiles] = await ctx.db.query<RowDataPacket[]>(
      'SELECT * FROM economy_profiles WHERE guild_id = ? AND user_id = ?',
      [guildId, userId],
    );
    if (profiles.length === 0) { res.status(404).json({ error: 'User not found' }); return; }

    const [inventory] = await ctx.db.query<RowDataPacket[]>(
      `SELECT ei2.*, ei.name, ei.emoji, ei.item_slug
       FROM economy_inventories ei2
       JOIN economy_items ei ON ei2.item_id = ei.id
       WHERE ei2.guild_id = ? AND ei2.user_id = ?`,
      [guildId, userId],
    );

    const [txHistory] = await ctx.db.query<RowDataPacket[]>(
      'SELECT * FROM economy_ledger WHERE guild_id = ? AND (target_id = ? OR actor_id = ?) ORDER BY created_at DESC LIMIT 50',
      [guildId, userId, userId],
    );

    res.json({
      profile: profiles[0],
      inventory,
      transactions: txHistory,
    });
  });

  // ── Transaction Ledger ───────────────────────────────────────────────
  router.get('/ledger', async (req, res) => {
    const guildId = req.query.guild_id as string;
    if (!guildId) { res.status(400).json({ error: 'guild_id required' }); return; }

    let sql = 'SELECT * FROM economy_ledger WHERE guild_id = ?';
    const params: unknown[] = [guildId];
    if (req.query.tx_type) { sql += ' AND tx_type = ?'; params.push(req.query.tx_type); }
    if (req.query.user_id) { sql += ' AND (target_id = ? OR actor_id = ?)'; params.push(req.query.user_id, req.query.user_id); }
    sql += ' ORDER BY created_at DESC LIMIT 100';
    const [entries] = await ctx.db.query<RowDataPacket[]>(sql, params as any);
    res.json({ entries });
  });

  // ── Jobs ─────────────────────────────────────────────────────────────
  router.get('/jobs', async (req, res) => {
    const guildId = req.query.guild_id as string;
    if (!guildId) { res.status(400).json({ error: 'guild_id required' }); return; }
    const [jobs] = await ctx.db.query<RowDataPacket[]>(
      'SELECT * FROM economy_jobs WHERE guild_id = ? ORDER BY name', [guildId],
    );
    res.json({ jobs });
  });

  // ── Quests ───────────────────────────────────────────────────────────
  router.get('/quests', async (req, res) => {
    const guildId = req.query.guild_id as string;
    if (!guildId) { res.status(400).json({ error: 'guild_id required' }); return; }
    const [quests] = await ctx.db.query<RowDataPacket[]>(
      'SELECT * FROM economy_quest_templates WHERE guild_id = ? ORDER BY quest_type, name', [guildId],
    );
    res.json({ quests });
  });

  // ── Achievements ─────────────────────────────────────────────────────
  router.get('/achievements', async (req, res) => {
    const guildId = req.query.guild_id as string;
    if (!guildId) { res.status(400).json({ error: 'guild_id required' }); return; }
    const [achievements] = await ctx.db.query<RowDataPacket[]>(
      'SELECT * FROM economy_achievements WHERE guild_id = ? ORDER BY points DESC', [guildId],
    );
    res.json({ achievements });
  });

  // ── Leaderboards ─────────────────────────────────────────────────────
  router.get('/leaderboard', async (req, res) => {
    const guildId = req.query.guild_id as string;
    const category = (req.query.category as string) ?? 'net_worth';
    if (!guildId) { res.status(400).json({ error: 'guild_id required' }); return; }

    let orderBy: string;
    switch (category) {
      case 'wallet': orderBy = 'wallet DESC'; break;
      case 'bank': orderBy = 'bank DESC'; break;
      case 'total_earned': orderBy = 'total_earned DESC'; break;
      case 'level': orderBy = 'level DESC, xp DESC'; break;
      default: orderBy = '(wallet + bank) DESC'; break;
    }

    const [entries] = await ctx.db.query<RowDataPacket[]>(
      `SELECT user_id, wallet, bank, total_earned, level, xp
       FROM economy_profiles
       WHERE guild_id = ? AND status = 'active'
       ORDER BY ${orderBy} LIMIT 100`,
      [guildId],
    );
    res.json({ entries });
  });

  // ── Marketplace ──────────────────────────────────────────────────────
  router.get('/marketplace', async (req, res) => {
    const guildId = req.query.guild_id as string;
    if (!guildId) { res.status(400).json({ error: 'guild_id required' }); return; }
    const [listings] = await ctx.db.query<RowDataPacket[]>(
      `SELECT ml.*, ei.name as item_name, ei.emoji as item_emoji
       FROM economy_market_listings ml
       JOIN economy_items ei ON ml.item_id = ei.id
       WHERE ml.guild_id = ?
       ORDER BY ml.created_at DESC LIMIT 100`,
      [guildId],
    );
    res.json({ listings });
  });

  // ── Statistics ───────────────────────────────────────────────────────
  router.get('/statistics', async (req, res) => {
    const guildId = req.query.guild_id as string;
    if (!guildId) { res.status(400).json({ error: 'guild_id required' }); return; }
    const [stats] = await ctx.db.query<RowDataPacket[]>(
      'SELECT * FROM economy_statistics WHERE guild_id = ? ORDER BY stat_date DESC LIMIT 30',
      [guildId],
    );
    res.json({ stats });
  });

  // ── Economy Config ───────────────────────────────────────────────────
  router.get('/config', async (req, res) => {
    const guildId = req.query.guild_id as string;
    if (!guildId) { res.status(400).json({ error: 'guild_id required' }); return; }
    const [rows] = await ctx.db.query<RowDataPacket[]>(
      'SELECT * FROM economy_config WHERE guild_id = ?', [guildId],
    );
    res.json({ config: rows[0] ?? null, global_config: ctx.config.economy });
  });

  // ── Notifications ────────────────────────────────────────────────────
  router.get('/notifications', async (req, res) => {
    const guildId = req.query.guild_id as string;
    const userId = req.query.user_id as string;
    if (!guildId || !userId) { res.status(400).json({ error: 'guild_id and user_id required' }); return; }
    const [notifs] = await ctx.db.query<RowDataPacket[]>(
      'SELECT * FROM economy_notifications WHERE guild_id = ? AND user_id = ? ORDER BY created_at DESC LIMIT 50',
      [guildId, userId],
    );
    res.json({ notifications: notifs });
  });

  return router;
}
