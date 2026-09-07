import { AuditLogEvent, StickerFormatType, type Sticker } from 'discord.js';
import type { App } from '../core/context';
import { resolveAuditActor } from '../utils/auditLog';

export async function handleStickerDelete(app: App, sticker: Sticker): Promise<void> {
  const guild = sticker.guildId ? app.client.guilds.cache.get(sticker.guildId) : null;
  if (guild) await app.antiNuke.observe({ guild, type: 'sticker_delete', targetType: 'sticker', targetId: sticker.id, before: { name: sticker.name } });
  const actorId = guild ? await resolveAuditActor(app, guild, AuditLogEvent.StickerDelete, { targetId: sticker.id }) : null;
  await app.logManager.log({
    event: 'sticker_delete',
    guildId: sticker.guildId ?? '0',
    actorId,
    message: `Sticker removed: ${sticker.name}`,
    details: { name: sticker.name, id: sticker.id },
    mediaUrls: sticker.format === StickerFormatType.Lottie ? undefined : [sticker.url],
  });
}

export default { name: 'stickerDelete', run: handleStickerDelete };
