import type { AutomodModule, ModuleContext } from '../manager';

const userJoinBuckets = new Map<string, number[]>();

export function createSpamRejoinsModule(): AutomodModule {
  return {
    name: 'spam_rejoins',
    async check(ctx: ModuleContext) {
      const cfg = ctx.app.config.automod.heuristics.spam_rejoins;
      if (!cfg || !cfg.enabled) return null;

      const guildId = ctx.member.guild.id;
      const userId = ctx.member.id;
      const now = Date.now();
      const windowMs = cfg.window_seconds * 1000;

      const key = `${guildId}:${userId}`;
      const bucket = userJoinBuckets.get(key) ?? [];
      
      const recent = bucket.filter((t) => now - t <= windowMs);
      recent.push(now);
      userJoinBuckets.set(key, recent.slice(-10)); // Keep max 10 to prevent mem leaks

      // Periodically clean up old entries
      if (Math.random() < 0.05) {
        for (const [k, v] of userJoinBuckets) {
          const valid = v.filter((t) => now - t <= windowMs);
          if (valid.length === 0) userJoinBuckets.delete(k);
          else userJoinBuckets.set(k, valid);
        }
      }

      if (recent.length >= cfg.threshold) {
        return {
          module: 'spam_rejoins',
          rule: 'spam_rejoins',
          reason: `User rejoined ${recent.length} times within ${cfg.window_seconds} seconds`,
          content: '',
        };
      }

      return null;
    },
  };
}
