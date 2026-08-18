import type { GuildEmoji } from 'discord.js';
import type { App } from '../core/context';

export async function handleEmojiDelete(app: App, emoji: GuildEmoji): Promise<void> {
  await app.logManager.log({
    event: 'emoji_delete',
    guildId: emoji.guild.id,
    message: `Emoji removed: ${emoji.name}`,
    details: { name: emoji.name, id: emoji.id, animated: emoji.animated },
    mediaUrls: [emoji.imageURL({ extension: emoji.animated ? 'gif' : 'png', size: 256 })],
  });
}

export default { name: 'emojiDelete', run: handleEmojiDelete };
