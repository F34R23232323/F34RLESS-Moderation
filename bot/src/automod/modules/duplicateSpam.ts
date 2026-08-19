import type { AutomodModule, ModuleContext } from '../manager';
import { MessageTracker } from '../tracker';
import { normalizeForMatching, combinedSimilarity } from '../../../../shared/src/index';

const FIRED_PRUNE_MS = 3600_000;

interface DuplicateFingerprint {
  norm: string;
  lastTs: number;
}

export function createDuplicateSpamModule(): AutomodModule {
  const byUser = new Map<string, DuplicateFingerprint[]>();
  const tracker = new MessageTracker();
  const firedAt = new Map<string, number>();

  return {
    name: 'duplicate_spam',
    async check(ctx: ModuleContext) {
      const cfg = ctx.app.config.automod.modules.duplicate_spam;
      if (!ctx.content) return null;
      const now = Date.now();
      const windowMs = cfg.window_seconds * 1000;

      const norm = normalizeForMatching(ctx.content);
      if (!norm) return null;

      const fps = byUser.get(ctx.member.id) ?? [];
      const live = fps.filter((f) => now - f.lastTs < windowMs);
      byUser.set(ctx.member.id, live);

      let fp = live.find((f) => combinedSimilarity(norm, f.norm) >= cfg.similarity_threshold);
      if (!fp) {
        fp = { norm, lastTs: now };
        live.push(fp);
      }
      fp.lastTs = now;

      const key = `dup:${ctx.member.id}:${fp.norm}`;
      tracker.push(key, now, ctx.message?.id);
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
        module: 'duplicate_spam',
        rule: 'duplicate_spam',
        reason: repeat
          ? `same/similar message posted ${count} times in ${cfg.window_seconds}s (repeat)`
          : `same/similar message posted ${count} times in ${cfg.window_seconds}s`,
        content: ctx.content,
        purge_message_ids: purgeIds,
        suppress_actions: repeat,
      };
    },
  };
}
