import type { AutomodModule, ModuleContext } from '../manager';
import { MessageTracker } from '../tracker';

const FIRED_PRUNE_MS = 3600_000;

export function createSpamModule(tracker: MessageTracker): AutomodModule {
  const firedAt = new Map<string, number>();

  return {
    name: 'spam',
    async check(ctx: ModuleContext) {
      const cfg = ctx.app.config.automod.modules.spam;
      if (!ctx.channel) return null;
      const key = `spam:${ctx.member.id}:${ctx.channel.id}`;
      const now = Date.now();
      tracker.push(key, now, ctx.message?.id);
      const windowMs = cfg.window_seconds * 1000;
      const count = tracker.countInWindow(key, windowMs, now);
      if (count < cfg.threshold) {
        if (firedAt.size > 500) {
          for (const [k, t] of firedAt) {
            if (now - t > FIRED_PRUNE_MS) firedAt.delete(k);
          }
        }
        return null;
      }

      const purgeIds = tracker
        .entriesInWindow(key, windowMs, now)
        .map((e) => e.id)
        .filter((id): id is string => Boolean(id));
      const repeat = now - (firedAt.get(key) ?? 0) < windowMs;
      if (!repeat) firedAt.set(key, now);

      return {
        module: 'spam',
        rule: 'spam',
        reason: repeat ? `${count} messages in ${cfg.window_seconds}s (repeat)` : `${count} messages in ${cfg.window_seconds}s`,
        content: ctx.content,
        purge_message_ids: purgeIds,
        suppress_actions: repeat,
      };
    },
  };
}
