import type { AutomodModule, ModuleContext } from '../manager';

const joinBuckets = new Map<string, number[]>();

export function createMassIdenticalJoinsModule(): AutomodModule {
  return {
    name: 'mass_identical_joins',
    async check(ctx: ModuleContext) {
      const cfg = ctx.app.config.automod.heuristics.mass_identical_joins;
      const guildId = ctx.member.guild.id;
      const now = Date.now();
      const windowMs = cfg.window_seconds * 1000;

      const bucket = joinBuckets.get(guildId) ?? [];
      const recent = bucket.filter((t) => now - t <= windowMs);
      recent.push(now);
      joinBuckets.set(guildId, recent.slice(-200));

      const counts = new Map<number, number>();
      for (const t of recent) counts.set(t, (counts.get(t) ?? 0) + 1);
      for (const [ts, count] of counts) {
        if (count >= cfg.threshold) {
          return {
            module: 'mass_identical_joins',
            rule: 'mass_identical_joins',
            reason: `${count} joins at identical timestamp (${new Date(ts).toISOString()})`,
            content: '',
          };
        }
      }
      return null;
    },
  };
}