import { AuditLogEvent, StickerFormatType, type Sticker } from 'discord.js';
import type { App } from '../core/context';
import { resolveAuditActor } from '../utils/auditLog';

export async function handleStickerUpdate(app: App, oldSticker: Sticker, newSticker: Sticker): Promise<void> {
  if (oldSticker.name === newSticker.name && oldSticker.description === newSticker.description) return;
  const changes: string[] = [];
  if (oldSticker.name !== newSticker.name) changes.push(`Name: ${oldSticker.name} -> ${newSticker.name}`);
  if (oldSticker.description !== newSticker.description) changes.push('Description changed');
  const guild = newSticker.guildId ? app.client.guilds.cache.get(newSticker.guildId) : null;
  if (guild) await app.antiNuke.observe({ guild, type: 'sticker_update', targetType: 'sticker', targetId: newSticker.id,
    before: { name: oldSticker.name }, after: { name: newSticker.name } });
  const actorId = guild ? await resolveAuditActor(app, guild, AuditLogEvent.StickerUpdate, { targetId: newSticker.id }) : null;
  await app.logManager.log({
    event: 'sticker_update',
    guildId: newSticker.guildId ?? '0',
    actorId,
    message: `Sticker updated: ${newSticker.name}`,
    details: { name: newSticker.name, id: newSticker.id, changes },
    mediaUrls: newSticker.format === StickerFormatType.Lottie ? undefined : [newSticker.url],
  });
}

export default { name: 'stickerUpdate', run: handleStickerUpdate };
