import type { AutomodModule, ModuleContext } from '../manager';
import { MessageTracker } from '../tracker';

const tracker = new MessageTracker();

export function createImageSpamModule(): AutomodModule {
  return {
    name: 'image_spam',
    async check(ctx: ModuleContext) {
      const cfg = ctx.app.config.automod.modules.image_spam;
      if (!ctx.message || !ctx.channel) return null;
      const hasImage = ctx.message.attachments.some((a) => a.contentType?.startsWith('image/'));
      if (!hasImage) return null;
      const key = `img:${ctx.member.id}:${ctx.channel.id}`;
      tracker.push(key);
      if (tracker.countInWindow(key, cfg.window_seconds * 1000) >= cfg.threshold) {
        return { module: 'image_spam', rule: 'image_spam', reason: 'too many images in window', content: ctx.content };
      }
      return null;
    },
  };
}