import type { AutomodModule, ModuleContext } from '../manager';

const joinEvents = new Map<string, number[]>();

export function createNewAccountVelocityModule(): AutomodModule {
  return {
    name: 'new_account_velocity',
    async check(ctx: ModuleContext) {
      const cfg = ctx.app.config.automod.heuristics.new_account_velocity;
      const guildId = ctx.member.guild.id;
      const now = Date.now();

      const accountAgeMs = now - ctx.member.user.createdTimestamp;
      if (accountAgeMs > cfg.max_account_age_days * 86400000) {
        return null;
      }

      const windowMs = cfg.window_seconds * 1000;
      const bucket = joinEvents.get(guildId) ?? [];
      const recent = bucket.filter((t) => now - t <= windowMs);
      recent.push(now);
      joinEvents.set(guildId, recent.slice(-500));

      if (recent.length >= cfg.threshold) {
        return {
          module: 'new_account_velocity',
          rule: 'new_account_velocity',
          reason: `${recent.length} new accounts (< ${cfg.max_account_age_days}d old) joined in ${cfg.window_seconds}s`,
          content: '',
        };
      }
      return null;
    },
  };
}