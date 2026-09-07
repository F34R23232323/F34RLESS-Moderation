import type { AutomodModule, ModuleContext } from '../manager';
import type { ScamHashStore, ScamHashEntry } from '../scamHashStore';
import { computeAHash } from '../scamHashStore';
import type { Attachment } from 'discord.js';

const isImage = (a: Attachment): boolean => a.contentType?.startsWith('image/') ?? /\.(png|jpe?g|gif|webp)$/i.test(a.name ?? '');

export function createScamImagesModule(store: ScamHashStore): AutomodModule {
  return {
    name: 'scam_images',
    async check(ctx: ModuleContext) {
      const cfg = ctx.app.config.automod.modules.scam_images;
      if (!cfg || !ctx.message) return null;
      if (store.count() === 0) return null;
      const images = [...ctx.message.attachments.values()].filter(isImage);
      if (images.length === 0) return null;

      for (const attachment of images) {
        const hex = await computeAHash(attachment.url);
        if (!hex) continue;
        const match = store.check(hex, cfg.hamming_distance_threshold);
        if (match) {
          return buildHit(ctx, match, attachment);
        }
      }
      return null;
    },
  };
}

function buildHit(ctx: ModuleContext, match: ScamHashEntry, attachment: Attachment) {
  const hit: import('../manager').AutomodHit = {
    module: 'scam_images',
    rule: 'scam_images',
    reason: `Scam image detected: ${match.description} (hash: ${match.hash})`,
    content: ctx.content || `[attachment: ${attachment.name ?? 'image'}]`,
  };
  return hit;
}
