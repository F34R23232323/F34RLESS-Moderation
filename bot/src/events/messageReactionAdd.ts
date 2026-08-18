import type { RowDataPacket } from 'mysql2/promise';
import type { MessageReaction, PartialMessageReaction, PartialUser, User } from 'discord.js';
import type { App } from '../core/context';

export async function handleMessageReactionAdd(
  app: App,
  reaction: MessageReaction | PartialMessageReaction,
  user: User | PartialUser,
): Promise<void> {
  try {
    if (user.bot) return;
    const cfg = app.config.community.starboard;
    if (!cfg.enabled || !cfg.channel_id) return;
    if (reaction.emoji.name !== '⭐') return;

    const message = reaction.message.partial ? await reaction.message.fetch() : reaction.message;
    if (!message.inGuild()) return;

    let count = 0;
    const fullReaction = reaction.partial ? await reaction.fetch() : reaction;
    for (const [, reactions] of message.reactions.cache) {
      if (reactions.emoji.name === '⭐') {
        count = reactions.count ?? 0;
      }
    }
    if (count < cfg.threshold) return;

    const existing = await app.db.query<RowDataPacket[]>(
      'SELECT star_message_id FROM starboard WHERE guild_id = ? AND message_id = ?',
      [message.guildId, message.id],
    );
    const channel = message.guild.channels.cache.get(cfg.channel_id);
    if (!channel || !('send' in channel)) return;

    const content = `Starred by ${count}\n${message.author ? `<@${message.author.id}>` : ''}: ${message.content.slice(0, 1500)}\n${message.url}`;
    if (existing[0][0]?.star_message_id) {
      const starMsg = await channel.messages.fetch(existing[0][0].star_message_id).catch(() => null);
      if (starMsg) {
        await starMsg.edit({ content });
        return;
      }
    }
    const sent = await channel.send({ content });
    await app.db.execute(
      `INSERT INTO starboard (guild_id, message_id, star_message_id, count) VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE star_message_id = VALUES(star_message_id), count = VALUES(count)`,
      [message.guildId, message.id, sent.id, count],
    );
  } catch (err) {
    app.logger.error('messageReactionAdd handler threw:', err);
  }
}

export default { name: 'messageReactionAdd', run: handleMessageReactionAdd };