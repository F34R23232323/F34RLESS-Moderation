import { AuditLogEvent, type GuildEmoji } from 'discord.js';
import type { App } from '../core/context';
import { resolveAuditActor } from '../utils/auditLog';

export async function handleEmojiCreate(app: App, emoji: GuildEmoji): Promise<void> {
  await app.antiNuke.observe({ guild: emoji.guild, type: 'emoji_create', targetType: 'emoji', targetId: emoji.id, after: { name: emoji.name } });
  const actorId = emoji.author?.id ?? (await resolveAuditActor(app, emoji.guild, AuditLogEvent.EmojiCreate, { targetId: emoji.id }));
  await app.logManager.log({
    event: 'emoji_create',
    guildId: emoji.guild.id,
    actorId,
    message: `Emoji added: ${emoji.name}`,
    details: { name: emoji.name, id: emoji.id, animated: emoji.animated, url: emoji.imageURL() },
    mediaUrls: [emoji.imageURL({ extension: emoji.animated ? 'gif' : 'png', size: 256 })],
  });
}

export default { name: 'emojiCreate', run: handleEmojiCreate };
