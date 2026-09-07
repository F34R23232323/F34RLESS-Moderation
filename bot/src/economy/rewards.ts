import type { Pool, RowDataPacket } from 'mysql2/promise';
import type { App } from '../core/context';
import type { LedgerEngine } from './ledger';
import type { EconomyJob } from './types';

export class RewardsService {
  constructor(
    private readonly app: App,
    private readonly ledger: LedgerEngine,
  ) {}

  private get db(): Pool { return this.app.db; }

  /** Claim daily reward. */
  async claimDaily(
    guildId: string,
    userId: string,
    idempotencyKey?: string,
  ): Promise<{ success: boolean; error?: string; amount?: number; streak?: number; bonus?: number }> {
    if (idempotencyKey) {
      const existing = await this.ledger.findByIdempotencyKey(idempotencyKey);
      if (existing) return { success: true, amount: existing.amount, streak: 0, bonus: 0 };
    }

    const profile = await this.ledger.getProfile(guildId, userId);
    const ec = this.app.config.economy.daily;
    if (!ec.enabled) return { success: false, error: 'Daily rewards are disabled.' };

    // Check cooldown via database
    const now = new Date();
    const [cdRows] = await this.db.query<RowDataPacket[]>(
      "SELECT * FROM economy_cooldowns WHERE guild_id = ? AND user_id = ? AND bucket = 'daily' AND expires_at > NOW()",
      [guildId, userId],
    );
    if (cdRows.length > 0) return { success: false, error: 'Daily reward already claimed. Come back later.' };

    // Calculate streak
    let streak = profile.daily_streak;
    const lastDaily = profile.last_daily_at ? new Date(profile.last_daily_at) : null;
    const tz = ec.timezone || 'UTC';
    const nowDay = this.getDayKey(now, tz);
    const lastDay = lastDaily ? this.getDayKey(lastDaily, tz) : null;

    if (lastDay && nowDay - lastDay === 1) {
      streak += 1;
    } else if (lastDay && nowDay - lastDay === 0) {
      return { success: false, error: 'Daily reward already claimed today.' };
    } else if (lastDay && nowDay - lastDay > 1 + ec.grace_tokens) {
      streak = 1; // Streak broken — start fresh
    } else {
      // Within grace token window — continue streak
      streak += 1;
    }

    // Calculate amount with streak bonus
    const baseAmount = this.randomInRange(ec.min_reward, ec.max_reward);
    const streakBonusBps = Math.min(streak * ec.streak_bonus_per_day_bps, ec.streak_bonus_max_bps);
    const bonus = Math.floor((baseAmount * streakBonusBps) / 10000);
    const totalAmount = baseAmount + bonus;

    // Credit FIRST, then set cooldown — if credit fails, user is not locked out
    await this.ledger.credit(guildId, userId, userId, totalAmount, 'daily_reward', {
      reason: `Daily reward (streak: ${streak})`,
      refType: 'daily',
      idempotencyKey,
      metadata: { streak, base_amount: baseAmount, bonus },
    });

    // Set cooldown only after successful credit
    const cooldownMs = 24 * 60 * 60 * 1000 - 60 * 1000;
    await this.db.execute(
      `INSERT INTO economy_cooldowns (guild_id, user_id, bucket, expires_at)
       VALUES (?, ?, 'daily', DATE_ADD(NOW(), INTERVAL ? SECOND))
       ON DUPLICATE KEY UPDATE expires_at = DATE_ADD(NOW(), INTERVAL ? SECOND)`,
      [guildId, userId, Math.floor(cooldownMs / 1000), Math.floor(cooldownMs / 1000)],
    );

    await this.db.execute(
      `UPDATE economy_profiles
       SET daily_streak = ?, last_daily_at = NOW()
       WHERE guild_id = ? AND user_id = ?`,
      [streak, guildId, userId],
    );

    return { success: true, amount: totalAmount, streak, bonus };
  }

  /** Claim weekly reward. */
  async claimWeekly(
    guildId: string,
    userId: string,
    idempotencyKey?: string,
  ): Promise<{ success: boolean; error?: string; amount?: number; streak?: number; bonus?: number }> {
    if (idempotencyKey) {
      const existing = await this.ledger.findByIdempotencyKey(idempotencyKey);
      if (existing) return { success: true, amount: existing.amount, streak: 0, bonus: 0 };
    }

    const profile = await this.ledger.getProfile(guildId, userId);
    const ec = this.app.config.economy.weekly;
    if (!ec.enabled) return { success: false, error: 'Weekly rewards are disabled.' };

    const [cdRows] = await this.db.query<RowDataPacket[]>(
      "SELECT * FROM economy_cooldowns WHERE guild_id = ? AND user_id = ? AND bucket = 'weekly' AND expires_at > NOW()",
      [guildId, userId],
    );
    if (cdRows.length > 0) return { success: false, error: 'Weekly reward already claimed.' };

    let streak = profile.weekly_streak;
    const lastWeekly = profile.last_weekly_at ? new Date(profile.last_weekly_at) : null;
    const now = new Date();
    const tz = ec.timezone || 'UTC';
    const nowWeek = this.getWeekKey(now, tz);
    const lastWeek = lastWeekly ? this.getWeekKey(lastWeekly, tz) : null;

    if (lastWeek && nowWeek - lastWeek === 1) {
      streak += 1;
    } else if (lastWeek && nowWeek === lastWeek) {
      return { success: false, error: 'Weekly reward already claimed this week.' };
    } else if (lastWeek && nowWeek - lastWeek > 1 + ec.grace_tokens) {
      streak = 1; // Streak broken
    } else {
      // Within grace token window — continue streak
      streak += 1;
    }

    const baseAmount = this.randomInRange(ec.min_reward, ec.max_reward);
    // Cap weekly streak bonus at 100% (10000 bps)
    const streakBonusBps = Math.min(streak * ec.streak_bonus_per_week_bps, 10000);
    const bonus = Math.floor((baseAmount * streakBonusBps) / 10000);
    const totalAmount = baseAmount + bonus;

    // Credit FIRST, then set cooldown
    await this.ledger.credit(guildId, userId, userId, totalAmount, 'weekly_reward', {
      reason: `Weekly reward (streak: ${streak})`,
      refType: 'weekly',
      idempotencyKey,
      metadata: { streak, base_amount: baseAmount, bonus },
    });

    const cooldownMs = 7 * 24 * 60 * 60 * 1000 - 60 * 1000;
    await this.db.execute(
      `INSERT INTO economy_cooldowns (guild_id, user_id, bucket, expires_at)
       VALUES (?, ?, 'weekly', DATE_ADD(NOW(), INTERVAL ? SECOND))
       ON DUPLICATE KEY UPDATE expires_at = DATE_ADD(NOW(), INTERVAL ? SECOND)`,
      [guildId, userId, Math.floor(cooldownMs / 1000), Math.floor(cooldownMs / 1000)],
    );

    await this.db.execute(
      `UPDATE economy_profiles SET weekly_streak = ?, last_weekly_at = NOW() WHERE guild_id = ? AND user_id = ?`,
      [streak, guildId, userId],
    );

    return { success: true, amount: totalAmount, streak, bonus };
  }

  // ── Jobs ───────────────────────────────────────────────────────────────

  async getJobs(guildId: string): Promise<EconomyJob[]> {
    const [rows] = await this.db.query<RowDataPacket[]>(
      'SELECT * FROM economy_jobs WHERE guild_id = ? AND enabled = 1 ORDER BY name',
      [guildId],
    );
    return rows as EconomyJob[];
  }

  async getJob(guildId: string, slug: string): Promise<EconomyJob | null> {
    const [rows] = await this.db.query<RowDataPacket[]>(
      'SELECT * FROM economy_jobs WHERE guild_id = ? AND job_slug = ?',
      [guildId, slug],
    );
    return rows.length > 0 ? (rows[0] as EconomyJob) : null;
  }

  async work(
    guildId: string,
    userId: string,
    jobSlug?: string,
    idempotencyKey?: string,
  ): Promise<{ success: boolean; error?: string; amount?: number; job?: EconomyJob; xp?: number }> {
    if (idempotencyKey) {
      const existing = await this.ledger.findByIdempotencyKey(idempotencyKey);
      if (existing) return { success: true, amount: existing.amount };
    }

    const profile = await this.ledger.getProfile(guildId, userId);
    const ecWork = this.app.config.economy.work;
    if (!ecWork.enabled) return { success: false, error: 'Work system is disabled.' };

    // Check cooldown
    const cooldownKey = jobSlug ? `work:${jobSlug}` : 'work';
    const [cdRows] = await this.db.query<RowDataPacket[]>(
      'SELECT * FROM economy_cooldowns WHERE guild_id = ? AND user_id = ? AND bucket = ? AND expires_at > NOW()',
      [guildId, userId, cooldownKey],
    );
    if (cdRows.length > 0) {
      const cd = cdRows[0] as { expires_at: string };
      return { success: false, error: `Work cooldown active. Try again <t:${Math.floor(new Date(cd.expires_at).getTime() / 1000)}:R>.` };
    }

    let job: EconomyJob | null = null;
    if (jobSlug) {
      job = await this.getJob(guildId, jobSlug);
      if (!job) return { success: false, error: `Job "${jobSlug}" not found.` };
      if (!job.enabled) return { success: false, error: 'That job is not available.' };
      if (job.required_level > profile.level) {
        return { success: false, error: `Requires economy level ${job.required_level}.` };
      }
    }

    const minP = job?.min_payout ?? 50;
    const maxP = job?.max_payout ?? 200;
    const amount = this.randomInRange(minP, maxP);
    const xp = job?.xp_reward ?? ecWork.xp_per_work;

    const cooldownSeconds = job?.cooldown_seconds ?? ecWork.default_cooldown_seconds;
    await this.db.execute(
      `INSERT INTO economy_cooldowns (guild_id, user_id, bucket, expires_at)
       VALUES (?, ?, ?, DATE_ADD(NOW(), INTERVAL ? SECOND))
       ON DUPLICATE KEY UPDATE expires_at = DATE_ADD(NOW(), INTERVAL ? SECOND)`,
      [guildId, userId, cooldownKey, cooldownSeconds],
    );

    await this.ledger.credit(guildId, userId, userId, amount, 'work_reward', {
      reason: `Work${job ? ` (${job.name})` : ''}`,
      refType: 'work',
      idempotencyKey,
      metadata: { job_slug: jobSlug ?? 'general', xp },
    });

    await this.db.execute(
      `UPDATE economy_profiles SET last_work_at = NOW(), xp = xp + ?, job_xp = job_xp + ? WHERE guild_id = ? AND user_id = ?`,
      [xp, xp, guildId, userId],
    );

    // Check level up
    await this.checkLevelUp(guildId, userId);

    return { success: true, amount, job: job ?? undefined, xp };
  }

  // ── Level Up ───────────────────────────────────────────────────────────

  async addXp(guildId: string, userId: string, xp: number): Promise<void> {
    await this.db.execute(
      'UPDATE economy_profiles SET xp = xp + ? WHERE guild_id = ? AND user_id = ?',
      [xp, guildId, userId],
    );
    await this.checkLevelUp(guildId, userId);
  }

  async checkLevelUp(guildId: string, userId: string): Promise<boolean> {
    const profile = await this.ledger.getProfile(guildId, userId);
    const ecLevel = this.app.config.economy.level;
    const xpNeeded = Math.floor(100 * Math.pow(ecLevel.xp_curve_multiplier, profile.level - 1));

    if (profile.xp >= xpNeeded) {
      await this.db.execute(
        'UPDATE economy_profiles SET level = level + 1, xp = xp - ? WHERE guild_id = ? AND user_id = ?',
        [xpNeeded, guildId, userId],
      );
      return true;
    }
    return false;
  }

  // ── Helpers ────────────────────────────────────────────────────────────

  private randomInRange(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  private getDayKey(date: Date, tz: string): number {
    const d = tz === 'UTC' ? date : new Date(date.toLocaleString('en-US', { timeZone: tz }));
    return Math.floor(d.getTime() / (24 * 60 * 60 * 1000));
  }

  private getWeekKey(date: Date, tz: string): number {
    const d = tz === 'UTC' ? date : new Date(date.toLocaleString('en-US', { timeZone: tz }));
    return Math.floor(d.getTime() / (7 * 24 * 60 * 60 * 1000));
  }
}
