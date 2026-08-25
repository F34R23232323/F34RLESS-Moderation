import { AuditLogEvent, type GuildEmoji } from 'discord.js';
import type { App } from '../core/context';
import { resolveAuditActor } from '../utils/auditLog';

export async function handleEmojiUpdate(app: App, oldEmoji: GuildEmoji, newEmoji: GuildEmoji): Promise<void> {
  if (oldEmoji.name === newEmoji.name && oldEmoji.roles.cache.size === newEmoji.roles.cache.size) return;
  const changes: string[] = [];
  if (oldEmoji.name !== newEmoji.name) changes.push(`Name: ${oldEmoji.name} -> ${newEmoji.name}`);
  if (oldEmoji.roles.cache.size !== newEmoji.roles.cache.size) changes.push('Restricted roles changed');
  const actorId = await resolveAuditActor(app, newEmoji.guild, AuditLogEvent.EmojiUpdate, { targetId: newEmoji.id });
  await app.logManager.log({
    event: 'emoji_update',
    guildId: newEmoji.guild.id,
    actorId,
    message: `Emoji updated: ${newEmoji.name}`,
    details: { name: newEmoji.name, id: newEmoji.id, changes },
    mediaUrls: [newEmoji.imageURL({ extension: newEmoji.animated ? 'gif' : 'png', size: 256 })],
  });
}

export default { name: 'emojiUpdate', run: handleEmojiUpdate };
