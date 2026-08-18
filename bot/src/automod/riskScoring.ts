import type { App } from '../core/context';

interface RiskEntry {
  score: number;
  updatedAt: number;
  meta: Record<string, number>;
}

export class RiskScoring {
  private readonly app: App;
  private readonly cache = new Map<string, RiskEntry>();

  constructor(app: App) {
    this.app = app;
  }

  public async add(userId: string, amount: number, guildId?: string): Promise<number> {
    const cfg = this.app.config.automod.risk_scoring;
    const key = `${guildId ?? 'g'}:${userId}`;
    const now = Date.now();
    const entry = this.cache.get(key) ?? { score: 0, updatedAt: now, meta: {} };
    entry.score = this.decayed(entry, now) + amount;
    entry.updatedAt = now;
    this.cache.set(key, entry);

    if (guildId) {
      await this.app.db.execute(
        `INSERT INTO risk_scores (guild_id, user_id, score) VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE score = VALUES(score)`,
        [guildId, userId, entry.score],
      );
    }

    if (cfg.enabled && entry.score >= cfg.threshold) {
      await this.triggerThreshold(userId, guildId);
    }
    return entry.score;
  }

  public get(userId: string, guildId?: string): number {
    const key = `${guildId ?? 'g'}:${userId}`;
    const entry = this.cache.get(key);
    if (!entry) return 0;
    return this.decayed(entry, Date.now());
  }

  private decayed(entry: RiskEntry, now: number): number {
    const cfg = this.app.config.automod.risk_scoring;
    const elapsed = now - entry.updatedAt;
    if (elapsed <= 0) return entry.score;
    const factor = Math.exp(-elapsed / (cfg.decay_seconds * 1000));
    return entry.score * factor;
  }

  private async triggerThreshold(userId: string, guildId?: string): Promise<void> {
    const guild = this.app.client.guilds.cache.get(guildId ?? '');
    if (!guild) return;
    const member = await guild.members.fetch(userId).catch(() => null);
    if (!member) return;
    await this.app.logManager.log({
      event: 'automod_trigger',
      guildId: guild.id,
      targetId: userId,
      message: `User <@${userId}> crossed composite risk threshold`,
      details: { module: 'risk_scoring', rule: 'risk-threshold' },
    });
  }
}