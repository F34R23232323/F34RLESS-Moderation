import type { Pool, RowDataPacket } from 'mysql2/promise';
import type { App } from '../core/context';
import type { LedgerEngine } from './ledger';
import type { StealOutcome } from './types';

export class StealingService {
  constructor(
    private readonly app: App,
    private readonly ledger: LedgerEngine,
  ) {}

  private get db(): Pool { return this.app.db; }

  /** Attempt to steal from another user. */
  async attemptSteal(
    guildId: string,
    attackerId: string,
    victimId: string,
    idempotencyKey?: string,
  ): Promise<{ success: boolean; outcome: StealOutcome; error?: string; amount?: number; fine?: number }> {
    if (idempotencyKey) {
      const existing = await this.ledger.findByIdempotencyKey(idempotencyKey);
      if (existing) {
        // Determine original outcome from the ledger entry
        const originalOutcome: StealOutcome = existing.tx_type === 'theft_gain' ? 'success' : 'failure';
        return {
          success: originalOutcome === 'success',
          outcome: originalOutcome,
          amount: existing.tx_type === 'theft_gain' ? existing.amount : undefined,
          fine: existing.tx_type === 'steal_fine' ? existing.amount : undefined,
        };
      }
    }

    const ec = this.app.config.economy.stealing;
    if (!ec.enabled) return { success: false, outcome: 'blocked', error: 'Stealing is disabled.' };
    if (attackerId === victimId) return { success: false, outcome: 'blocked', error: 'Cannot steal from yourself.' };

    // Check cooldown
    const [cdRows] = await this.db.query<RowDataPacket[]>(
      "SELECT * FROM economy_cooldowns WHERE guild_id = ? AND user_id = ? AND bucket = 'steal' AND expires_at > NOW()",
      [guildId, attackerId],
    );
    if (cdRows.length > 0) return { success: false, outcome: 'blocked', error: 'Steal cooldown active.' };

    // Check daily attempt limit
    const today = new Date().toISOString().split('T')[0];
    const [attemptRows] = await this.db.query<RowDataPacket[]>(
      "SELECT COUNT(*) as cnt FROM economy_steal_log WHERE guild_id = ? AND attacker_id = ? AND created_at >= ?",
      [guildId, attackerId, `${today} 00:00:00`],
    );
    if ((attemptRows[0] as any).cnt >= ec.daily_attempt_limit) {
      return { success: false, outcome: 'blocked', error: 'Daily steal attempt limit reached.' };
    }

    // Check victim grace period
    const [graceRows] = await this.db.query<RowDataPacket[]>(
      "SELECT * FROM economy_steal_log WHERE guild_id = ? AND victim_id = ? AND attacker_id = ? AND outcome = 'success' AND created_at > DATE_SUB(NOW(), INTERVAL ? MINUTE)",
      [guildId, victimId, attackerId, ec.victim_grace_minutes],
    );
    if (graceRows.length > 0) {
      return { success: false, outcome: 'blocked', error: 'Victim is on a grace period.' };
    }

    // Check victim opted out
    const [optOut] = await this.db.query<RowDataPacket[]>(
      "SELECT opted_out FROM economy_profiles WHERE guild_id = ? AND user_id = ?",
      [guildId, victimId],
    );
    if ((optOut[0] as any)?.opted_out) {
      return { success: false, outcome: 'immune', error: 'That user has opted out of stealing.' };
    }

    // Get profiles
    const attackerProfile = await this.ledger.getProfile(guildId, attackerId);
    const victimProfile = await this.ledger.getProfile(guildId, victimId);

    if (attackerProfile.wallet < ec.min_attacker_balance) {
      return { success: false, outcome: 'blocked', error: 'Insufficient wallet balance to attempt steal.' };
    }
    if (victimProfile.wallet < ec.min_victim_balance) {
      return { success: false, outcome: 'immune', error: 'That user has too little to steal from.' };
    }

    // Determine outcome
    const maxStealPct = ec.max_percentage_bps / 10000;
    const maxSteal = Math.floor(victimProfile.wallet * maxStealPct);
    const cappedMax = Math.min(maxSteal, ec.max_amount);
    const cappedMin = Math.max(ec.min_amount, Math.min(cappedMax, 1));

    if (cappedMin > cappedMax) {
      return { success: false, outcome: 'blocked', error: 'Nothing to steal.' };
    }

    // Set cooldown
    await this.db.execute(
      `INSERT INTO economy_cooldowns (guild_id, user_id, bucket, expires_at)
       VALUES (?, ?, 'steal', DATE_ADD(NOW(), INTERVAL ? SECOND))
       ON DUPLICATE KEY UPDATE expires_at = DATE_ADD(NOW(), INTERVAL ? SECOND)`,
      [guildId, attackerId, ec.cooldown_seconds],
    );

    // Random outcome: success chance ~50%
    const success = Math.random() < 0.5;

    if (success) {
      const amount = cappedMin + Math.floor(Math.random() * (cappedMax - cappedMin + 1));

      await this.ledger.debit(guildId, attackerId, victimId, amount, 'stolen', {
        reason: `Stolen by <@${attackerId}>`,
        refType: 'steal',
        idempotencyKey,
        metadata: { attacker: attackerId, victim: victimId },
      });
      await this.ledger.credit(guildId, attackerId, attackerId, amount, 'theft_gain', {
        reason: `Stolen from <@${victimId}>`,
        refType: 'steal',
        metadata: { attacker: attackerId, victim: victimId },
      });

      await this.db.execute(
        `INSERT INTO economy_steal_log (guild_id, attacker_id, victim_id, outcome, amount_stolen, idempotency_key)
         VALUES (?, ?, ?, 'success', ?, ?)`,
        [guildId, attackerId, victimId, amount, idempotencyKey ?? null],
      );

      return { success: true, outcome: 'success', amount };
    } else {
      const fine = ec.failure_fine;
      const { success: fineOk } = await this.ledger.debit(
        guildId, attackerId, attackerId, fine, 'steal_fine',
        {
          reason: `Steal attempt failed against <@${victimId}>`,
          refType: 'steal',
          idempotencyKey,
        },
      );

      await this.db.execute(
        `INSERT INTO economy_steal_log (guild_id, attacker_id, victim_id, outcome, fine_amount, idempotency_key)
         VALUES (?, ?, ?, 'failure', ?, ?)`,
        [guildId, attackerId, victimId, fineOk ? fine : 0, idempotencyKey ?? null],
      );

      return { success: false, outcome: 'failure', fine: fineOk ? fine : 0 };
    }
  }

  /** Get steal stats for a user. */
  async getStats(guildId: string, userId: string): Promise<{
    attempts: number; successes: number; failures: number;
    stolen: number; lost: number; fined: number;
  }> {
    const [rows] = await this.db.query<RowDataPacket[]>(
      `SELECT
        COUNT(*) as attempts,
        SUM(outcome = 'success') as successes,
        SUM(outcome = 'failure') as failures,
        SUM(CASE WHEN outcome = 'success' THEN amount_stolen ELSE 0 END) as stolen,
        SUM(CASE WHEN outcome = 'success' THEN amount_stolen ELSE 0 END) as lost,
        SUM(CASE WHEN outcome = 'failure' THEN fine_amount ELSE 0 END) as fined
       FROM economy_steal_log
       WHERE guild_id = ? AND (attacker_id = ? OR victim_id = ?)`,
      [guildId, userId, userId],
    );
    const r = rows[0] as any;
    return {
      attempts: Number(r?.attempts ?? 0),
      successes: Number(r?.successes ?? 0),
      failures: Number(r?.failures ?? 0),
      stolen: Number(r?.stolen ?? 0),
      lost: Number(r?.lost ?? 0),
      fined: Number(r?.fined ?? 0),
    };
  }
}
