import type { GuildEmoji } from 'discord.js';
import type { App } from '../core/context';

export async function handleEmojiCreate(app: App, emoji: GuildEmoji): Promise<void> {
  await app.logManager.log({
    event: 'emoji_create',
    guildId: emoji.guild.id,
    actorId: emoji.author?.id ?? null,
    message: `Emoji added: ${emoji.name}`,
    details: { name: emoji.name, id: emoji.id, animated: emoji.animated, url: emoji.imageURL() },
    mediaUrls: [emoji.imageURL({ extension: emoji.animated ? 'gif' : 'png', size: 256 })],
  });
}

export default { name: 'emojiCreate', run: handleEmojiCreate };
