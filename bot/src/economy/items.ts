import type { Pool, RowDataPacket } from 'mysql2/promise';
import type { App } from '../core/context';
import type { EconomyItem, EconomyShop, ShopListing, InventoryEntry, ItemRarity, ItemType } from './types';
import type { LedgerEngine } from './ledger';

export class ItemShopService {
  constructor(
    private readonly app: App,
    private readonly ledger: LedgerEngine,
  ) {}

  private get db(): Pool { return this.app.db; }

  // ── Shops ──────────────────────────────────────────────────────────────

  async getShops(guildId: string): Promise<EconomyShop[]> {
    const [rows] = await this.db.query<RowDataPacket[]>(
      'SELECT * FROM economy_shops WHERE guild_id = ? AND enabled = 1 ORDER BY sort_order, name',
      [guildId],
    );
    return rows as EconomyShop[];
  }

  async getShop(guildId: string, slug: string): Promise<EconomyShop | null> {
    const [rows] = await this.db.query<RowDataPacket[]>(
      'SELECT * FROM economy_shops WHERE guild_id = ? AND shop_slug = ?',
      [guildId, slug],
    );
    return rows.length > 0 ? (rows[0] as EconomyShop) : null;
  }

  async getShopItems(shopId: number): Promise<any[]> {
    const [rows] = await this.db.query<RowDataPacket[]>(
      `SELECT sl.*, ei.*
       FROM economy_shop_listings sl
       JOIN economy_items ei ON sl.item_id = ei.id
       WHERE sl.shop_id = ? AND sl.enabled = 1 AND ei.enabled = 1
       ORDER BY sl.sort_order, ei.name`,
      [shopId],
    );
    return rows as any[];
  }

  async createShop(guildId: string, data: { slug: string; name: string; description?: string; emoji?: string }): Promise<EconomyShop> {
    const [result] = await this.db.execute(
      `INSERT INTO economy_shops (guild_id, shop_slug, name, description, emoji, sort_order)
       VALUES (?, ?, ?, ?, ?, (SELECT t.ms + 1 FROM (SELECT COALESCE(MAX(sort_order), 0) AS ms FROM economy_shops WHERE guild_id = ?) t))`,
      [guildId, data.slug, data.name, data.description ?? null, data.emoji ?? null, guildId],
    );
    return (await this.getShop(guildId, data.slug))!;
  }

  // ── Items ──────────────────────────────────────────────────────────────

  async getItem(guildId: string, slug: string): Promise<EconomyItem | null> {
    const [rows] = await this.db.query<RowDataPacket[]>(
      'SELECT * FROM economy_items WHERE guild_id = ? AND item_slug = ?',
      [guildId, slug],
    );
    return rows.length > 0 ? (rows[0] as EconomyItem) : null;
  }

  async getItemById(id: number): Promise<EconomyItem | null> {
    const [rows] = await this.db.query<RowDataPacket[]>(
      'SELECT * FROM economy_items WHERE id = ?',
      [id],
    );
    return rows.length > 0 ? (rows[0] as EconomyItem) : null;
  }

  async getItems(guildId: string, opts: { category?: string; rarity?: string; enabled?: boolean } = {}): Promise<EconomyItem[]> {
    let sql = 'SELECT * FROM economy_items WHERE guild_id = ?';
    const params: unknown[] = [guildId];
    if (opts.category) { sql += ' AND category_slug = ?'; params.push(opts.category); }
    if (opts.rarity) { sql += ' AND rarity = ?'; params.push(opts.rarity); }
    if (opts.enabled !== undefined) { sql += ' AND enabled = ?'; params.push(opts.enabled ? 1 : 0); }
    sql += ' ORDER BY name';
    const [rows] = await this.db.query<RowDataPacket[]>(sql, params);
    return rows as EconomyItem[];
  }

  async createItem(guildId: string, data: Partial<EconomyItem> & { item_slug: string; name: string }): Promise<EconomyItem> {
    const ec = this.app.config.economy;
    const [result] = await this.db.execute(
      `INSERT INTO economy_items
        (guild_id, item_slug, name, description, emoji, category_slug, rarity, item_type,
         buy_price, sell_price, max_stack, ownership_limit, allow_duplicate, tradable,
         sellable, giftable, stock, restock_amount, restock_interval_seconds,
         per_user_purchase_limit, per_user_purchase_window_seconds,
         required_level, required_role_id, required_item_slug,
         effect_type, effect_metadata, hidden, enabled, source, tags)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        guildId, data.item_slug, data.name,
        data.description ?? null, data.emoji ?? null,
        data.category_slug ?? null, data.rarity ?? 'common',
        data.item_type ?? 'consumable',
        data.buy_price ?? 0, data.sell_price ?? 0,
        data.max_stack ?? 99, data.ownership_limit ?? null,
        data.allow_duplicate ?? 0, data.tradable ?? 1,
        data.sellable ?? 1, data.giftable ?? 1,
        data.stock ?? null, data.restock_amount ?? null,
        data.restock_interval_seconds ?? null,
        data.per_user_purchase_limit ?? null,
        data.per_user_purchase_window_seconds ?? null,
        data.required_level ?? 0, data.required_role_id ?? null,
        data.required_item_slug ?? null,
        data.effect_type ?? null,
        data.effect_metadata ? JSON.stringify(data.effect_metadata) : null,
        data.hidden ?? 0, data.enabled ?? 1,
        data.source ?? 'custom',
        data.tags ? JSON.stringify(data.tags) : null,
      ],
    );
    return (await this.getItem(guildId, data.item_slug))!;
  }

  // ── Purchase ───────────────────────────────────────────────────────────

  async purchaseItem(
    guildId: string,
    userId: string,
    itemSlug: string,
    quantity: number = 1,
    idempotencyKey?: string,
  ): Promise<{ success: boolean; error?: string; item?: EconomyItem; quantity?: number; totalCost?: number }> {
    if (idempotencyKey) {
      const existing = await this.ledger.findByIdempotencyKey(idempotencyKey);
      if (existing) {
        const item = await this.getItem(guildId, itemSlug);
        return { success: true, item: item ?? undefined, quantity, totalCost: existing.amount };
      }
    }

    const item = await this.getItem(guildId, itemSlug);
    if (!item || !item.enabled) return { success: false, error: 'Item not found or disabled.' };
    if (item.hidden) return { success: false, error: 'Item not found.' };

    // Validate quantity
    if (quantity <= 0) return { success: false, error: 'Quantity must be at least 1.' };

    // Check stock — use conditional UPDATE to prevent overselling
    if (item.stock !== null) {
      const [stockResult] = await this.db.execute(
        'UPDATE economy_items SET stock = stock - ? WHERE id = ? AND stock >= ?',
        [quantity, item.id, quantity],
      );
      if ((stockResult as any).affectedRows === 0) {
        return { success: false, error: 'Insufficient stock.' };
      }
    }

    // Check requirements
    const profile = await this.ledger.getProfile(guildId, userId);
    if (item.required_level > 0 && profile.level < item.required_level) {
      // Restore stock if we decremented it
      if (item.stock !== null) {
        await this.db.execute('UPDATE economy_items SET stock = stock + ? WHERE id = ?', [quantity, item.id]);
      }
      return { success: false, error: `Requires economy level ${item.required_level}.` };
    }

    // Check ownership limit
    if (item.ownership_limit !== null && !item.allow_duplicate) {
      const [invRows] = await this.db.query<RowDataPacket[]>(
        'SELECT COALESCE(SUM(quantity), 0) as owned FROM economy_inventories WHERE guild_id = ? AND user_id = ? AND item_id = ?',
        [guildId, userId, item.id],
      );
      const owned = (invRows[0] as any).owned;
      if (owned + quantity > item.ownership_limit) {
        if (item.stock !== null) await this.db.execute('UPDATE economy_items SET stock = stock + ? WHERE id = ?', [quantity, item.id]);
        return { success: false, error: `Ownership limit reached. You already own ${owned}/${item.ownership_limit}.` };
      }
    }

    // Check per-user purchase limit
    if (item.per_user_purchase_limit !== null && item.per_user_purchase_window_seconds !== null) {
      const since = new Date(Date.now() - item.per_user_purchase_window_seconds * 1000).toISOString();
      const [purchaseRows] = await this.db.query<RowDataPacket[]>(
        `SELECT COALESCE(SUM(amount), 0) as purchased FROM economy_ledger
         WHERE guild_id = ? AND target_id = ? AND tx_type = 'item_purchase'
         AND ref_id = ? AND created_at >= ?`,
        [guildId, userId, String(item.id), since],
      );
      const purchased = (purchaseRows[0] as any).purchased;
      if (purchased + quantity > item.per_user_purchase_limit) {
        if (item.stock !== null) await this.db.execute('UPDATE economy_items SET stock = stock + ? WHERE id = ?', [quantity, item.id]);
        return { success: false, error: `Purchase limit reached for this item.` };
      }
    }

    const pricePerUnit = item.buy_price;
    const totalCost = pricePerUnit * quantity;

    // Debit wallet
    const { success } = await this.ledger.debit(
      guildId, userId, userId, totalCost, 'item_purchase',
      {
        reason: `Purchased ${quantity}x ${item.name}`,
        refType: 'item',
        refId: String(item.id),
        idempotencyKey,
        metadata: { item_slug: itemSlug, quantity, price_per_unit: pricePerUnit },
      },
    );

    if (!success) {
      // Restore stock
      if (item.stock !== null) await this.db.execute('UPDATE economy_items SET stock = stock + ? WHERE id = ?', [quantity, item.id]);
      return { success: false, error: 'Insufficient funds.' };
    }

    // Add to inventory (upsert to prevent race condition)
    await this.addToInventory(guildId, userId, item.id, quantity, 'shop');

    return { success: true, item, quantity, totalCost };
  }

  // ── Sell ───────────────────────────────────────────────────────────────

  async sellItem(
    guildId: string,
    userId: string,
    itemSlug: string,
    quantity: number = 1,
    idempotencyKey?: string,
  ): Promise<{ success: boolean; error?: string; totalValue?: number }> {
    // Idempotency check BEFORE any mutations
    if (idempotencyKey) {
      const existing = await this.ledger.findByIdempotencyKey(idempotencyKey);
      if (existing) return { success: true, totalValue: existing.amount };
    }

    if (quantity <= 0) return { success: false, error: 'Quantity must be at least 1.' };

    const item = await this.getItem(guildId, itemSlug);
    if (!item) return { success: false, error: 'Item not found.' };
    if (!item.sellable) return { success: false, error: 'This item cannot be sold.' };

    const totalValue = item.sell_price * quantity;

    // Use conditional UPDATE to atomically decrement inventory
    const [invResult] = await this.db.execute(
      'UPDATE economy_inventories SET quantity = quantity - ? WHERE guild_id = ? AND user_id = ? AND item_id = ? AND quantity >= ?',
      [quantity, guildId, userId, item.id, quantity],
    );
    if ((invResult as any).affectedRows === 0) {
      return { success: false, error: `You don't have ${quantity}x ${item.name}.` };
    }

    // Clean up zero-quantity rows
    await this.db.execute(
      'DELETE FROM economy_inventories WHERE guild_id = ? AND user_id = ? AND item_id = ? AND quantity <= 0',
      [guildId, userId, item.id],
    );

    // Credit wallet
    await this.ledger.credit(
      guildId, userId, userId, totalValue, 'item_sale',
      {
        reason: `Sold ${quantity}x ${item.name}`,
        refType: 'item',
        refId: String(item.id),
        idempotencyKey,
        metadata: { item_slug: itemSlug, quantity, sell_price: item.sell_price },
      },
    );

    return { success: true, totalValue };
  }

  // ── Inventory ──────────────────────────────────────────────────────────

  async getInventory(guildId: string, userId: string): Promise<any[]> {
    const [rows] = await this.db.query<RowDataPacket[]>(
      `SELECT ei2.*, ei.*
       FROM economy_inventories ei2
       JOIN economy_items ei ON ei2.item_id = ei.id
       WHERE ei2.guild_id = ? AND ei2.user_id = ? AND ei.enabled = 1
       ORDER BY ei.name`,
      [guildId, userId],
    );
    return rows as any[];
  }

  async addToInventory(guildId: string, userId: string, itemId: number, quantity: number, source: string): Promise<void> {
    const item = await this.getItemById(itemId);
    const maxStack = item?.max_stack ?? 99;
    // Atomic upsert — prevents duplicate rows from race conditions
    await this.db.execute(
      `INSERT INTO economy_inventories (guild_id, user_id, item_id, quantity, source)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE quantity = LEAST(quantity + VALUES(quantity), ${maxStack})`,
      [guildId, userId, itemId, quantity, source],
    );
  }

  async removeFromInventory(guildId: string, userId: string, itemId: number, quantity: number): Promise<boolean> {
    const [existing] = await this.db.query<RowDataPacket[]>(
      'SELECT * FROM economy_inventories WHERE guild_id = ? AND user_id = ? AND item_id = ?',
      [guildId, userId, itemId],
    );
    if (existing.length === 0) return false;

    const inv = existing[0] as InventoryEntry;
    if (inv.quantity <= quantity) {
      await this.db.execute('DELETE FROM economy_inventories WHERE id = ?', [inv.id]);
    } else {
      await this.db.execute('UPDATE economy_inventories SET quantity = quantity - ? WHERE id = ?', [quantity, inv.id]);
    }
    return true;
  }

  // ── Item Effects ───────────────────────────────────────────────────────

  async getActiveEffects(guildId: string, userId: string): Promise<any[]> {
    const [rows] = await this.db.query<RowDataPacket[]>(
      `SELECT eie.*, ei.name as item_name, ei.emoji as item_emoji
       FROM economy_item_effects eie
       JOIN economy_items ei ON eie.item_id = ei.id
       WHERE eie.guild_id = ? AND eie.user_id = ?
       AND (eie.expires_at IS NULL OR eie.expires_at > NOW())`,
      [guildId, userId],
    );
    return rows as any[];
  }

  async applyEffect(
    guildId: string,
    userId: string,
    itemId: number,
    effectType: string,
    effectData: Record<string, unknown>,
    expiresAt?: Date,
  ): Promise<void> {
    await this.db.execute(
      `INSERT INTO economy_item_effects (guild_id, user_id, item_id, effect_type, effect_data, expires_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [guildId, userId, itemId, effectType, JSON.stringify(effectData), expiresAt ?? null],
    );
  }

  async removeEffect(effectId: number): Promise<void> {
    await this.db.execute('DELETE FROM economy_item_effects WHERE id = ?', [effectId]);
  }

  async cleanupExpiredEffects(): Promise<number> {
    const [result] = await this.db.execute(
      'DELETE FROM economy_item_effects WHERE expires_at IS NOT NULL AND expires_at <= NOW()',
    );
    return (result as any).affectedRows;
  }
}
