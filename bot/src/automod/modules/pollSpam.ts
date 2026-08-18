import type { AutomodModule, ModuleContext } from '../manager';
import { MessageTracker } from '../tracker';

const tracker = new MessageTracker();

export function createPollSpamModule(): AutomodModule {
  return {
    name: 'poll_spam',
    async check(ctx: ModuleContext) {
      const cfg = ctx.app.config.automod.modules.poll_spam;
      if (!ctx.channel) return null;
      const hasPoll = Boolean((ctx.message as unknown as { poll?: unknown }).poll);
      if (!hasPoll) return null;
      const key = `poll:${ctx.member.id}`;
      tracker.push(key);
      if (tracker.countInWindow(key, cfg.window_seconds * 1000) >= cfg.threshold) {
        return {
          module: 'poll_spam',
          rule: 'poll_spam',
          reason: `too many polls in ${cfg.window_seconds}s`,
          content: ctx.content,
        };
      }
      return null;
    },
  };
}