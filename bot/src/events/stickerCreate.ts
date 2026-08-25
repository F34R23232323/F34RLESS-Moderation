import { AuditLogEvent, StickerFormatType, type Sticker } from 'discord.js';
import type { App } from '../core/context';
import { resolveAuditActor } from '../utils/auditLog';

export async function handleStickerCreate(app: App, sticker: Sticker): Promise<void> {
  const guild = sticker.guildId ? app.client.guilds.cache.get(sticker.guildId) : null;
  const actorId = guild ? await resolveAuditActor(app, guild, AuditLogEvent.StickerCreate, { targetId: sticker.id }) : null;
  await app.logManager.log({
    event: 'sticker_create',
    guildId: sticker.guildId ?? '0',
    actorId,
    message: `Sticker added: ${sticker.name}`,
    details: { name: sticker.name, id: sticker.id, description: sticker.description, format: sticker.format },
    mediaUrls: sticker.format === StickerFormatType.Lottie ? undefined : [sticker.url],
  });
}

export default { name: 'stickerCreate', run: handleStickerCreate };
