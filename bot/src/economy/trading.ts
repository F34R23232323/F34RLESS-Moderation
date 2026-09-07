import type { Pool, RowDataPacket } from 'mysql2/promise';
import type { App } from '../core/context';
import type { LedgerEngine } from './ledger';
import type { ItemShopService } from './items';
import type { EconomyTrade, TradeStatus } from './types';

export class TradingService {
  constructor(
    private readonly app: App,
    private readonly ledger: LedgerEngine,
    private readonly items: ItemShopService,
  ) {}

  private get db(): Pool { return this.app.db; }

  /** Create a new trade with a recipient. */
  async createTrade(guildId: string, initiatorId: string, recipientId: string): Promise<EconomyTrade | string> {
    if (initiatorId === recipientId) return 'Cannot trade with yourself.';

    const ec = this.app.config.economy.trading;
    if (!ec.enabled) return 'Trading is disabled.';

    // Check trade limits
    const [activeRows] = await this.db.query<RowDataPacket[]>(
      `SELECT COUNT(*) as cnt FROM economy_trades
       WHERE guild_id = ? AND (initiator_id = ? OR recipient_id = ?) AND status IN ('draft', 'reviewing')`,
      [guildId, initiatorId, recipientId],
    );
    if ((activeRows[0] as any).cnt >= ec.max_active_trades) {
      return 'Trade limit reached. Complete or cancel existing trades first.';
    }

    // Check both users are economy-active
    await this.ledger.getProfile(guildId, initiatorId);
    await this.ledger.getProfile(guildId, recipientId);

    const expiresAt = new Date(Date.now() + ec.trade_expiry_minutes * 60 * 1000);
    await this.db.execute(
      `INSERT INTO economy_trades (guild_id, initiator_id, recipient_id, status, expires_at)
       VALUES (?, ?, ?, 'draft', ?)`,
      [guildId, initiatorId, recipientId, expiresAt],
    );

    const [rows] = await this.db.query<RowDataPacket[]>(
      'SELECT * FROM economy_trades WHERE guild_id = ? AND initiator_id = ? AND recipient_id = ? AND status = ? ORDER BY id DESC LIMIT 1',
      [guildId, initiatorId, recipientId, 'draft'],
    );
    return rows[0] as EconomyTrade;
  }

  /** Add currency or an item to a trade offer. */
  async addToTrade(
    guildId: string,
    tradeId: number,
    userId: string,
    side: 'initiator' | 'recipient',
    opts: { currency?: number; itemId?: number; quantity?: number },
  ): Promise<{ success: boolean; error?: string; trade?: EconomyTrade }> {
    const trade = await this.getTrade(guildId, tradeId);
    if (!trade) return { success: false, error: 'Trade not found.' };
    if (trade.status !== 'draft') return { success: false, error: 'Trade is no longer in draft.' };
    if ((side === 'initiator' && trade.initiator_id !== userId) ||
        (side === 'recipient' && trade.recipient_id !== userId)) {
      return { success: false, error: 'You are not part of this trade.' };
    }

    const profile = await this.ledger.getProfile(guildId, userId);
    if (opts.currency && profile.wallet < opts.currency) {
      return { success: false, error: 'Insufficient wallet balance.' };
    }

    const currencyKey = side === 'initiator' ? 'initiator_currency' : 'recipient_currency';
    const itemsKey = side === 'initiator' ? 'initiator_items' : 'recipient_items';

    if (opts.currency) {
      await this.db.execute(
        `UPDATE economy_trades SET ${currencyKey} = ?, version = version + 1 WHERE id = ?`,
        [opts.currency, tradeId],
      );
    }

    if (opts.itemId && opts.quantity) {
      const currentItems = JSON.parse(String(trade[itemsKey] ?? '[]')) as Array<{ item_id: number; quantity: number }>;
      const existing = currentItems.find((i) => i.item_id === opts.itemId);
      if (existing) {
        existing.quantity += opts.quantity!;
      } else {
        currentItems.push({ item_id: opts.itemId, quantity: opts.quantity! });
      }
      await this.db.execute(
        `UPDATE economy_trades SET ${itemsKey} = ?, version = version + 1 WHERE id = ?`,
        [JSON.stringify(currentItems), tradeId],
      );
    }

    // Invalidate all confirmations when offer changes
    await this.db.execute(
      "UPDATE economy_trades SET confirmed_by = JSON_ARRAY() WHERE id = ? AND status = 'draft'",
      [tradeId],
    );

    const updated = await this.getTrade(guildId, tradeId);
    return { success: true, trade: updated! };
  }

  /** Confirm a trade. When both parties confirm, execute the trade atomically. */
  async confirmTrade(
    guildId: string,
    tradeId: number,
    userId: string,
  ): Promise<{ success: boolean; error?: string; completed?: boolean }> {
    const trade = await this.getTrade(guildId, tradeId);
    if (!trade) return { success: false, error: 'Trade not found.' };
    if (trade.status !== 'draft') return { success: false, error: 'Trade is not in draft status.' };

    const isInitiator = trade.initiator_id === userId;
    const isRecipient = trade.recipient_id === userId;
    if (!isInitiator && !isRecipient) return { success: false, error: 'You are not part of this trade.' };

    const confirmedBy = JSON.parse(String(trade.confirmed_by ?? '[]')) as string[];
    if (confirmedBy.includes(userId)) return { success: false, error: 'You have already confirmed.' };

    confirmedBy.push(userId);

    const ec = this.app.config.economy.trading;
    if (ec.require_confirmation && confirmedBy.length < 2) {
      await this.db.execute(
        'UPDATE economy_trades SET confirmed_by = ?, status = ?, version = version + 1 WHERE id = ?',
        [JSON.stringify(confirmedBy), 'reviewing', tradeId],
      );
      return { success: true, completed: false };
    }

    // Both confirmed — execute atomically
    return this.settleTrade(guildId, trade, confirmedBy);
  }

  /** Cancel a trade. */
  async cancelTrade(guildId: string, tradeId: number, userId: string): Promise<{ success: boolean; error?: string }> {
    const trade = await this.getTrade(guildId, tradeId);
    if (!trade) return { success: false, error: 'Trade not found.' };
    if (trade.status !== 'draft' && trade.status !== 'reviewing') {
      return { success: false, error: 'Trade cannot be cancelled.' };
    }
    if (trade.initiator_id !== userId && trade.recipient_id !== userId) {
      return { success: false, error: 'You are not part of this trade.' };
    }

    await this.db.execute(
      "UPDATE economy_trades SET status = 'cancelled', version = version + 1 WHERE id = ?",
      [tradeId],
    );
    return { success: true };
  }

  /** Get a trade by ID. */
  async getTrade(guildId: string, tradeId: number): Promise<EconomyTrade | null> {
    const [rows] = await this.db.query<RowDataPacket[]>(
      'SELECT * FROM economy_trades WHERE guild_id = ? AND id = ?',
      [guildId, tradeId],
    );
    return rows.length > 0 ? (rows[0] as EconomyTrade) : null;
  }

  /** Expire stale trades. */
  async expireStaleTrades(): Promise<number> {
    const [result] = await this.db.execute(
      "UPDATE economy_trades SET status = 'expired' WHERE status IN ('draft', 'reviewing') AND expires_at <= NOW()",
    );
    return (result as any).affectedRows;
  }

  private async settleTrade(
    guildId: string,
    trade: EconomyTrade,
    confirmedBy: string[],
  ): Promise<{ success: boolean; error?: string; completed?: boolean }> {
    const conn = await this.db.getConnection();
    try {
      await conn.beginTransaction();

      // Re-check trade version and status
      const [checkRows] = await conn.query<RowDataPacket[]>(
        'SELECT * FROM economy_trades WHERE id = ? AND status IN (?, ?) FOR UPDATE',
        [trade.id, 'draft', 'reviewing'],
      );
      if (checkRows.length === 0) {
        await conn.rollback();
        return { success: false, error: 'Trade was modified or already settled.' };
      }
      const currentTrade = checkRows[0] as EconomyTrade;

      // Settle currency
      if (currentTrade.initiator_currency > 0) {
        const [initProfile] = await conn.query<RowDataPacket[]>(
          'SELECT wallet FROM economy_profiles WHERE guild_id = ? AND user_id = ? FOR UPDATE',
          [guildId, currentTrade.initiator_id],
        );
        if ((initProfile[0] as any)?.wallet < currentTrade.initiator_currency) {
          await conn.rollback();
          return { success: false, error: 'Initiator has insufficient balance for the agreed offer.' };
        }
      }
      if (currentTrade.recipient_currency > 0) {
        const [recipProfile] = await conn.query<RowDataPacket[]>(
          'SELECT wallet FROM economy_profiles WHERE guild_id = ? AND user_id = ? FOR UPDATE',
          [guildId, currentTrade.recipient_id],
        );
        if ((recipProfile[0] as any)?.wallet < currentTrade.recipient_currency) {
          await conn.rollback();
          return { success: false, error: 'Recipient has insufficient balance for the agreed offer.' };
        }
      }

      // Move currency
      if (currentTrade.initiator_currency > 0) {
        await conn.execute(
          'UPDATE economy_profiles SET wallet = wallet - ? WHERE guild_id = ? AND user_id = ?',
          [currentTrade.initiator_currency, guildId, currentTrade.initiator_id],
        );
        await conn.execute(
          'UPDATE economy_profiles SET wallet = wallet + ?, total_earned = total_earned + ? WHERE guild_id = ? AND user_id = ?',
          [currentTrade.initiator_currency, currentTrade.initiator_currency, guildId, currentTrade.recipient_id],
        );
      }
      if (currentTrade.recipient_currency > 0) {
        await conn.execute(
          'UPDATE economy_profiles SET wallet = wallet - ? WHERE guild_id = ? AND user_id = ?',
          [currentTrade.recipient_currency, guildId, currentTrade.recipient_id],
        );
        await conn.execute(
          'UPDATE economy_profiles SET wallet = wallet + ?, total_earned = total_earned + ? WHERE guild_id = ? AND user_id = ?',
          [currentTrade.recipient_currency, currentTrade.recipient_currency, guildId, currentTrade.initiator_id],
        );
      }

      // Move items — verify debit succeeded before crediting
      const initItems = JSON.parse(String(currentTrade.initiator_items ?? '[]')) as Array<{ item_id: number; quantity: number }>;
      const recipItems = JSON.parse(String(currentTrade.recipient_items ?? '[]')) as Array<{ item_id: number; quantity: number }>;

      for (const item of initItems) {
        const [debitResult] = await conn.execute(
          'UPDATE economy_inventories SET quantity = quantity - ? WHERE guild_id = ? AND user_id = ? AND item_id = ? AND quantity >= ?',
          [item.quantity, guildId, currentTrade.initiator_id, item.item_id, item.quantity],
        );
        if ((debitResult as any).affectedRows === 0) {
          await conn.rollback();
          return { success: false, error: 'Trade failed: initiator no longer has required items.' };
        }
        // Use upsert for credit
        await conn.execute(
          `INSERT INTO economy_inventories (guild_id, user_id, item_id, quantity, source)
           VALUES (?, ?, ?, ?, 'trade')
           ON DUPLICATE KEY UPDATE quantity = quantity + VALUES(quantity)`,
          [guildId, currentTrade.recipient_id, item.item_id, item.quantity],
        );
      }

      for (const item of recipItems) {
        const [debitResult] = await conn.execute(
          'UPDATE economy_inventories SET quantity = quantity - ? WHERE guild_id = ? AND user_id = ? AND item_id = ? AND quantity >= ?',
          [item.quantity, guildId, currentTrade.recipient_id, item.item_id, item.quantity],
        );
        if ((debitResult as any).affectedRows === 0) {
          await conn.rollback();
          return { success: false, error: 'Trade failed: recipient no longer has required items.' };
        }
        await conn.execute(
          `INSERT INTO economy_inventories (guild_id, user_id, item_id, quantity, source)
           VALUES (?, ?, ?, ?, 'trade')
           ON DUPLICATE KEY UPDATE quantity = quantity + VALUES(quantity)`,
          [guildId, currentTrade.initiator_id, item.item_id, item.quantity],
        );
      }

      // Mark completed
      await conn.execute(
        "UPDATE economy_trades SET status = 'completed', confirmed_by = ?, version = version + 1 WHERE id = ?",
        [JSON.stringify(confirmedBy), trade.id],
      );

      await conn.commit();
      return { success: true, completed: true };
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }
}
