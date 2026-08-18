import type { AutomodModule, ModuleContext } from '../manager';
import { MessageTracker } from '../tracker';

const tracker = new MessageTracker();

export function createMassImagesModule(): AutomodModule {
  return {
    name: 'mass_images',
    async check(ctx: ModuleContext) {
      const cfg = ctx.app.config.automod.modules.mass_images;
      if (!ctx.message || !ctx.channel) return null;
      const images = ctx.message.attachments.filter((a) => a.contentType?.startsWith('image/')).size;
      if (images === 0) return null;
      const key = `massimg:${ctx.member.id}:${ctx.channel.id}`;
      for (let i = 0; i < images; i++) tracker.push(key);
      if (tracker.countInWindow(key, cfg.window_seconds * 1000) >= cfg.threshold) {
        return {
          module: 'mass_images',
          rule: 'mass_images',
          reason: `mass image dump (${tracker.countInWindow(key, cfg.window_seconds * 1000)} in window)`,
          content: ctx.content,
        };
      }
      return null;
    },
  };
}