import type { AutomodModule, ModuleContext } from '../manager';

const FIRED_PRUNE_MS = 3600_000;

export function createMassPingModule(): AutomodModule {
  /** Per sender: target userId → list of recent timestamps */
  const pingHistory = new Map<string, Map<string, number[]>>();
  const firedAt = new Map<string, number>();

  return {
    name: 'mass_ping',
    async check(ctx: ModuleContext) {
      const cfg = ctx.app.config.automod.modules.mass_ping;
      if (!ctx.channel) return null;
      if (!ctx.message) return null;

      const now = Date.now();
      const windowMs = cfg.spam_window_seconds * 1000;

      // ── Mode 1: too many mentions in a single message ──────────────────────
      const mentionCount = ctx.message.mentions.users.size;
      if (mentionCount > cfg.max_mentions) {
        const key = `mass_ping:${ctx.member.id}:${ctx.channel.id}`;
        const repeat = now - (firedAt.get(key) ?? 0) < windowMs;
        if (!repeat) firedAt.set(key, now);
        return {
          module: 'mass_ping',
          rule: 'mass_mentions',
          reason: repeat
            ? `${mentionCount} mentions in one message (repeat)`
            : `${mentionCount} mentions in one message (limit ${cfg.max_mentions})`,
          content: ctx.content,
          purge_message_ids: [ctx.message.id],
          suppress_actions: repeat,
          dm_mentioned_users: [...ctx.message.mentions.users.keys()].filter((id) => id !== ctx.member.id),
        };
      }

      // ── Mode 2: spam-pinging the same user across messages ────────────────
      const senderKey = ctx.member.id;
      if (!pingHistory.has(senderKey)) pingHistory.set(senderKey, new Map());
      const senderHistory = pingHistory.get(senderKey)!;

      for (const [targetId] of ctx.message.mentions.users) {
        if (targetId === ctx.member.id) continue; // ignore self-mentions
        let timestamps = senderHistory.get(targetId);
        if (!timestamps) {
          timestamps = [];
          senderHistory.set(targetId, timestamps);
        }
        timestamps.push(now);
        // Prune old entries
        const cutoff = now - windowMs;
        while (timestamps.length > 0 && timestamps[0] < cutoff) timestamps.shift();

        if (timestamps.length >= cfg.spam_threshold) {
          const ruleKey = `mass_ping_spam:${ctx.member.id}:${targetId}`;
          const repeat = now - (firedAt.get(ruleKey) ?? 0) < windowMs;
          if (!repeat) firedAt.set(ruleKey, now);
          return {
            module: 'mass_ping',
            rule: 'spam_ping',
            reason: repeat
              ? `pinged <@${targetId}> ${timestamps.length} times in ${cfg.spam_window_seconds}s (repeat)`
              : `pinged <@${targetId}> ${timestamps.length} times in ${cfg.spam_window_seconds}s`,
            content: ctx.content,
            purge_message_ids: [ctx.message.id],
            suppress_actions: repeat,
            dm_mentioned_users: [targetId],
          };
        }
      }

      return null;
    },
  };
}
