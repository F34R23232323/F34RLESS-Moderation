import { randomUUID } from 'crypto';
import type { Pool, PoolConnection, RowDataPacket } from 'mysql2/promise';
import type { App } from '../core/context';
import type { LedgerEntry, EconomyProfile } from './types';

export type LedgerDirection = 'credit' | 'debit';

export interface LedgerParams {
  guildId: string;
  actorId: string;
  targetId?: string;
  txType: string;
  amount: number;
  direction: LedgerDirection;
  balanceAfter: number;
  refType?: string;
  refId?: string;
  idempotencyKey?: string;
  reason?: string;
  metadata?: Record<string, unknown>;
  source?: string;
}

function generateTxId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export class LedgerEngine {
  constructor(private readonly app: App) {}

  private get db(): Pool {
    return this.app.db;
  }

  /** Append an immutable ledger entry. Never call from normal code directly —
   *  use debit/credit helpers which handle idempotency. */
  async append(params: LedgerParams): Promise<LedgerEntry> {
    const txId = generateTxId();
    const [result] = await this.db.execute(
      `INSERT INTO economy_ledger
        (tx_id, guild_id, actor_id, target_id, tx_type, amount, direction,
         balance_after, ref_type, ref_id, idempotency_key, reason, metadata, source)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        txId,
        params.guildId,
        params.actorId,
        params.targetId ?? null,
        params.txType,
        Math.max(0, Math.floor(params.amount)),
        params.direction,
        Math.max(0, Math.floor(params.balanceAfter)),
        params.refType ?? null,
        params.refId ?? null,
        params.idempotencyKey ?? null,
        params.reason ?? null,
        params.metadata ? JSON.stringify(params.metadata) : null,
        params.source ?? 'system',
      ],
    );

    return {
      id: (result as any).insertId,
      tx_id: txId,
      guild_id: params.guildId,
      actor_id: params.actorId,
      target_id: params.targetId ?? null,
      tx_type: params.txType,
      amount: Math.max(0, Math.floor(params.amount)),
      direction: params.direction,
      balance_after: Math.max(0, Math.floor(params.balanceAfter)),
      ref_type: params.refType ?? null,
      ref_id: params.refId ?? null,
      idempotency_key: params.idempotencyKey ?? null,
      reason: params.reason ?? null,
      metadata: params.metadata ?? null,
      source: params.source ?? 'system',
      created_at: new Date().toISOString(),
    };
  }

  /** Atomic credit: add funds to a user's wallet. Returns the new balance. */
  async credit(
    guildId: string,
    actorId: string,
    targetUserId: string,
    amount: number,
    txType: string,
    opts: { reason?: string; refType?: string; refId?: string; idempotencyKey?: string; metadata?: Record<string, unknown>; source?: string } = {},
  ): Promise<number> {
    if (opts.idempotencyKey) {
      const existing = await this.findByIdempotencyKey(opts.idempotencyKey);
      if (existing) return existing.balance_after;
    }

    const amountInt = Math.max(0, Math.floor(amount));
    const conn = await this.db.getConnection();
    try {
      await conn.beginTransaction();

      const [rows] = await conn.query<RowDataPacket[]>(
        'SELECT id, wallet FROM economy_profiles WHERE guild_id = ? AND user_id = ? FOR UPDATE',
        [guildId, targetUserId],
      );

      let profile = rows[0] as EconomyProfile | undefined;
      if (!profile) {
        const ec = this.app.config.economy;
        await conn.execute(
          `INSERT INTO economy_profiles (guild_id, user_id, wallet, bank, total_earned)
           VALUES (?, ?, ?, ?, ?)`,
          [guildId, targetUserId, ec.currency.starting_wallet, ec.currency.starting_bank, 0],
        );
        profile = { id: 0, wallet: ec.currency.starting_wallet, bank: ec.currency.starting_bank, total_earned: 0 } as EconomyProfile;
      }

      const newBalance = Math.min(
        profile.wallet + amountInt,
        this.app.config.economy.currency.max_wallet,
      );
      const actualCredit = newBalance - profile.wallet;

      await conn.execute(
        'UPDATE economy_profiles SET wallet = ?, total_earned = total_earned + ? WHERE guild_id = ? AND user_id = ?',
        [newBalance, actualCredit, guildId, targetUserId],
      );

      const entry = await this.appendInConnection(conn, {
        guildId,
        actorId,
        targetId: targetUserId,
        txType,
        amount: actualCredit,
        direction: 'credit',
        balanceAfter: newBalance,
        refType: opts.refType,
        refId: opts.refId,
        idempotencyKey: opts.idempotencyKey,
        reason: opts.reason,
        metadata: opts.metadata,
        source: opts.source,
      });

      await conn.commit();
      return newBalance;
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }

  /** Atomic debit: remove funds from a user's wallet. Returns the new balance. */
  async debit(
    guildId: string,
    actorId: string,
    targetUserId: string,
    amount: number,
    txType: string,
    opts: { reason?: string; refType?: string; refId?: string; idempotencyKey?: string; metadata?: Record<string, unknown>; source?: string } = {},
  ): Promise<{ newBalance: number; success: boolean }> {
    if (opts.idempotencyKey) {
      const existing = await this.findByIdempotencyKey(opts.idempotencyKey);
      if (existing) return { newBalance: existing.balance_after, success: true };
    }

    const amountInt = Math.max(0, Math.floor(amount));
    if (amountInt === 0) {
      return { newBalance: 0, success: false };
    }
    const conn = await this.db.getConnection();
    try {
      await conn.beginTransaction();

      const [rows] = await conn.query<RowDataPacket[]>(
        'SELECT id, wallet FROM economy_profiles WHERE guild_id = ? AND user_id = ? FOR UPDATE',
        [guildId, targetUserId],
      );

      const profile = rows[0] as EconomyProfile | undefined;
      if (!profile || profile.wallet < amountInt) {
        await conn.commit();
        return { newBalance: profile?.wallet ?? 0, success: false };
      }

      const newBalance = profile.wallet - amountInt;
      await conn.execute(
        'UPDATE economy_profiles SET wallet = ?, total_spent = total_spent + ? WHERE guild_id = ? AND user_id = ?',
        [newBalance, amountInt, guildId, targetUserId],
      );

      await this.appendInConnection(conn, {
        guildId,
        actorId,
        targetId: targetUserId,
        txType,
        amount: amountInt,
        direction: 'debit',
        balanceAfter: newBalance,
        refType: opts.refType,
        refId: opts.refId,
        idempotencyKey: opts.idempotencyKey,
        reason: opts.reason,
        metadata: opts.metadata,
        source: opts.source,
      });

      await conn.commit();
      return { newBalance, success: true };
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }

  /** Atomic transfer between two users in one transaction. */
  async transfer(
    guildId: string,
    fromUserId: string,
    toUserId: string,
    amount: number,
    opts: { fee?: number; reason?: string; refType?: string; refId?: string; idempotencyKey?: string } = {},
  ): Promise<{ success: boolean; fromBalance: number; toBalance: number; fee: number }> {
    if (opts.idempotencyKey) {
      const existing = await this.findByIdempotencyKey(opts.idempotencyKey);
      if (existing) return { success: true, fromBalance: existing.balance_after, toBalance: existing.balance_after, fee: 0 };
    }

    const amountInt = Math.max(0, Math.floor(amount));
    const feeInt = Math.max(0, Math.floor(opts.fee ?? 0));
    const totalDebit = amountInt + feeInt;
    const conn = await this.db.getConnection();
    try {
      await conn.beginTransaction();

      const [fromRows] = await conn.query<RowDataPacket[]>(
        'SELECT id, wallet FROM economy_profiles WHERE guild_id = ? AND user_id = ? FOR UPDATE',
        [guildId, fromUserId],
      );
      const fromProfile = fromRows[0] as EconomyProfile | undefined;
      if (!fromProfile || fromProfile.wallet < totalDebit) {
        await conn.commit();
        return { success: false, fromBalance: fromProfile?.wallet ?? 0, toBalance: 0, fee: feeInt };
      }

      const [toRows] = await conn.query<RowDataPacket[]>(
        'SELECT id, wallet FROM economy_profiles WHERE guild_id = ? AND user_id = ? FOR UPDATE',
        [guildId, toUserId],
      );
      let toProfile = toRows[0] as EconomyProfile | undefined;
      if (!toProfile) {
        const ec = this.app.config.economy;
        await conn.execute(
          `INSERT INTO economy_profiles (guild_id, user_id, wallet, bank) VALUES (?, ?, ?, ?)`,
          [guildId, toUserId, ec.currency.starting_wallet, ec.currency.starting_bank],
        );
        toProfile = { id: 0, wallet: ec.currency.starting_wallet } as EconomyProfile;
      }

      const maxWallet = this.app.config.economy.currency.max_wallet;
      const newFromBalance = fromProfile.wallet - totalDebit;
      const newToBalance = Math.min(toProfile.wallet + amountInt, maxWallet);
      const actualCredit = newToBalance - toProfile.wallet;

      await conn.execute(
        'UPDATE economy_profiles SET wallet = ?, total_spent = total_spent + ? WHERE guild_id = ? AND user_id = ?',
        [newFromBalance, totalDebit, guildId, fromUserId],
      );
      await conn.execute(
        'UPDATE economy_profiles SET wallet = ?, total_earned = total_earned + ? WHERE guild_id = ? AND user_id = ?',
        [newToBalance, actualCredit, guildId, toUserId],
      );

      const txType = 'transfer';
      const txMeta = { to_user: toUserId, fee: feeInt };

      await this.appendInConnection(conn, {
        guildId, actorId: fromUserId, targetId: fromUserId, txType,
        amount: totalDebit, direction: 'debit', balanceAfter: newFromBalance,
        refType: opts.refType, refId: opts.refId, idempotencyKey: opts.idempotencyKey,
        reason: opts.reason, metadata: txMeta, source: 'transfer',
      });
      await this.appendInConnection(conn, {
        guildId, actorId: fromUserId, targetId: toUserId, txType,
        amount: actualCredit, direction: 'credit', balanceAfter: newToBalance,
        refType: opts.refType, refId: opts.refId,
        reason: opts.reason, metadata: txMeta, source: 'transfer',
      });

      if (feeInt > 0) {
        // Fee is burned — no credit recipient, just a debit entry
        await this.appendInConnection(conn, {
          guildId, actorId: fromUserId, targetId: fromUserId, txType: 'transfer_fee',
          amount: feeInt, direction: 'debit', balanceAfter: newFromBalance,
          reason: 'Transfer fee', metadata: { original_transfer: opts.refId }, source: 'fee',
        });
      }

      await conn.commit();
      return { success: true, fromBalance: newFromBalance, toBalance: newToBalance, fee: feeInt };
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }

  /** Deposit from wallet to bank. */
  async deposit(
    guildId: string,
    userId: string,
    amount: number,
    idempotencyKey?: string,
  ): Promise<{ success: boolean; wallet: number; bank: number }> {
    if (idempotencyKey) {
      const existing = await this.findByIdempotencyKey(idempotencyKey);
      if (existing) {
        // Re-fetch actual current balances
        const [rows] = await this.db.query<RowDataPacket[]>(
          'SELECT wallet, bank FROM economy_profiles WHERE guild_id = ? AND user_id = ?',
          [guildId, userId],
        );
        const p = rows[0] as any;
        return { success: true, wallet: p?.wallet ?? 0, bank: p?.bank ?? 0 };
      }
    }

    const amountInt = Math.max(0, Math.floor(amount));
    const conn = await this.db.getConnection();
    try {
      await conn.beginTransaction();

      const [rows] = await conn.query<RowDataPacket[]>(
        'SELECT id, wallet, bank FROM economy_profiles WHERE guild_id = ? AND user_id = ? FOR UPDATE',
        [guildId, userId],
      );
      const profile = rows[0] as EconomyProfile | undefined;
      if (!profile || profile.wallet < amountInt) {
        await conn.commit();
        return { success: false, wallet: profile?.wallet ?? 0, bank: profile?.bank ?? 0 };
      }

      const maxBank = this.app.config.economy.currency.max_bank;
      const newWallet = profile.wallet - amountInt;
      const newBank = Math.min(profile.bank + amountInt, maxBank);
      const actualDeposit = newBank - profile.bank;

      await conn.execute(
        'UPDATE economy_profiles SET wallet = ?, bank = ? WHERE guild_id = ? AND user_id = ?',
        [newWallet, newBank, guildId, userId],
      );

      await this.appendInConnection(conn, {
        guildId, actorId: userId, targetId: userId, txType: 'deposit',
        amount: actualDeposit, direction: 'debit', balanceAfter: newWallet,
        idempotencyKey, source: 'banking',
      });
      await this.appendInConnection(conn, {
        guildId, actorId: userId, targetId: userId, txType: 'deposit',
        amount: actualDeposit, direction: 'credit', balanceAfter: newBank,
        source: 'banking',
      });

      await conn.commit();
      return { success: true, wallet: newWallet, bank: newBank };
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }

  /** Withdraw from bank to wallet. */
  async withdraw(
    guildId: string,
    userId: string,
    amount: number,
    idempotencyKey?: string,
  ): Promise<{ success: boolean; wallet: number; bank: number }> {
    if (idempotencyKey) {
      const existing = await this.findByIdempotencyKey(idempotencyKey);
      if (existing) {
        const [rows] = await this.db.query<RowDataPacket[]>(
          'SELECT wallet, bank FROM economy_profiles WHERE guild_id = ? AND user_id = ?',
          [guildId, userId],
        );
        const p = rows[0] as any;
        return { success: true, wallet: p?.wallet ?? 0, bank: p?.bank ?? 0 };
      }
    }

    const amountInt = Math.max(0, Math.floor(amount));
    const conn = await this.db.getConnection();
    try {
      await conn.beginTransaction();

      const [rows] = await conn.query<RowDataPacket[]>(
        'SELECT id, wallet, bank FROM economy_profiles WHERE guild_id = ? AND user_id = ? FOR UPDATE',
        [guildId, userId],
      );
      const profile = rows[0] as EconomyProfile | undefined;
      if (!profile || profile.bank < amountInt) {
        await conn.commit();
        return { success: false, wallet: profile?.wallet ?? 0, bank: profile?.bank ?? 0 };
      }

      const maxWallet = this.app.config.economy.currency.max_wallet;
      const newBank = profile.bank - amountInt;
      const newWallet = Math.min(profile.wallet + amountInt, maxWallet);
      const actualWithdraw = newWallet - profile.wallet;

      await conn.execute(
        'UPDATE economy_profiles SET wallet = ?, bank = ? WHERE guild_id = ? AND user_id = ?',
        [newWallet, newBank, guildId, userId],
      );

      await this.appendInConnection(conn, {
        guildId, actorId: userId, targetId: userId, txType: 'withdraw',
        amount: actualWithdraw, direction: 'debit', balanceAfter: newBank,
        idempotencyKey, source: 'banking',
      });
      await this.appendInConnection(conn, {
        guildId, actorId: userId, targetId: userId, txType: 'withdraw',
        amount: actualWithdraw, direction: 'credit', balanceAfter: newWallet,
        source: 'banking',
      });

      await conn.commit();
      return { success: true, wallet: newWallet, bank: newBank };
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }

  /** Get a user's profile, creating one if it doesn't exist. */
  async getProfile(guildId: string, userId: string): Promise<EconomyProfile> {
    const ec = this.app.config.economy;
    // Upsert to avoid race condition between concurrent creates
    await this.db.execute(
      `INSERT INTO economy_profiles (guild_id, user_id, wallet, bank)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE guild_id = guild_id`,
      [guildId, userId, ec.currency.starting_wallet, ec.currency.starting_bank],
    );

    const [rows] = await this.db.query<RowDataPacket[]>(
      'SELECT * FROM economy_profiles WHERE guild_id = ? AND user_id = ?',
      [guildId, userId],
    );
    return rows[0] as EconomyProfile;
  }

  /** Get profile without auto-creating. Returns null if no profile exists. */
  async getProfileOrNull(guildId: string, userId: string): Promise<EconomyProfile | null> {
    const [rows] = await this.db.query<RowDataPacket[]>(
      'SELECT * FROM economy_profiles WHERE guild_id = ? AND user_id = ?',
      [guildId, userId],
    );
    return rows.length > 0 ? (rows[0] as EconomyProfile) : null;
  }

  /** Check idempotency key. Returns the existing entry if found. */
  async findByIdempotencyKey(key: string): Promise<LedgerEntry | null> {
    const [rows] = await this.db.query<RowDataPacket[]>(
      'SELECT * FROM economy_ledger WHERE idempotency_key = ? LIMIT 1',
      [key],
    );
    return rows.length > 0 ? (rows[0] as LedgerEntry) : null;
  }

  /** Get transaction history for a user. */
  async getHistory(
    guildId: string,
    userId: string,
    opts: { limit?: number; offset?: number; txType?: string } = {},
  ): Promise<LedgerEntry[]> {
    let sql = 'SELECT * FROM economy_ledger WHERE guild_id = ? AND (target_id = ? OR actor_id = ?)';
    const params: unknown[] = [guildId, userId, userId];

    if (opts.txType) {
      sql += ' AND tx_type = ?';
      params.push(opts.txType);
    }

    sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(opts.limit ?? 25, opts.offset ?? 0);

    const [rows] = await this.db.query<RowDataPacket[]>(sql, params);
    return rows as LedgerEntry[];
  }

  /** Get a single transaction by ID. */
  async getTransaction(txId: string): Promise<LedgerEntry | null> {
    const [rows] = await this.db.query<RowDataPacket[]>(
      'SELECT * FROM economy_ledger WHERE tx_id = ? LIMIT 1',
      [txId],
    );
    return rows.length > 0 ? (rows[0] as LedgerEntry) : null;
  }

  /** Internal: append ledger entry within an existing connection. */
  private async appendInConnection(conn: PoolConnection, params: LedgerParams): Promise<LedgerEntry> {
    const txId = generateTxId();
    const [result] = await conn.execute(
      `INSERT INTO economy_ledger
        (tx_id, guild_id, actor_id, target_id, tx_type, amount, direction,
         balance_after, ref_type, ref_id, idempotency_key, reason, metadata, source)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        txId, params.guildId, params.actorId, params.targetId ?? null,
        params.txType, Math.max(0, Math.floor(params.amount)), params.direction,
        Math.max(0, Math.floor(params.balanceAfter)),
        params.refType ?? null, params.refId ?? null, params.idempotencyKey ?? null,
        params.reason ?? null,
        params.metadata ? JSON.stringify(params.metadata) : null,
        params.source ?? 'system',
      ],
    );

    return {
      id: (result as any).insertId,
      tx_id: txId,
      guild_id: params.guildId,
      actor_id: params.actorId,
      target_id: params.targetId ?? null,
      tx_type: params.txType,
      amount: Math.max(0, Math.floor(params.amount)),
      direction: params.direction,
      balance_after: Math.max(0, Math.floor(params.balanceAfter)),
      ref_type: params.refType ?? null,
      ref_id: params.refId ?? null,
      idempotency_key: params.idempotencyKey ?? null,
      reason: params.reason ?? null,
      metadata: params.metadata ?? null,
      source: params.source ?? 'system',
      created_at: new Date().toISOString(),
    };
  }
}
