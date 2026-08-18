import type { Message } from 'discord.js';
import type { App } from '../core/context';
import type { RowDataPacket } from 'mysql2/promise';

export async function handleMessageCreateDM(app: App, message: Message): Promise<void> {
  try {
    if (message.author.bot || message.guild) return;
    const cfg = app.config.modmail;
    if (!cfg.enabled) return;

    const [rows] = await app.db.query<RowDataPacket[]>(
      "SELECT id, thread_id FROM modmail_threads WHERE user_id = ? AND status = 'open' LIMIT 1",
      [message.author.id],
    );
    const guild = app.client.guilds.cache.first();
    if (!guild) return;

    if (rows.length === 0) {
      if (!cfg.category_id) return;
      const thread: any = await guild.channels.create({
        name: `modmail-${message.author.username.toLowerCase().replace(/[^a-z0-9]/g, '')}`,
        type: 11,
        parent: cfg.category_id as never,
        reason: 'Modmail opened',
      } as never);
      for (const roleId of cfg.support_roles) {
        const role = guild.roles.cache.get(roleId);
        if (role) await thread.permissionOverwrites.create(role.id, { SendMessages: true, ViewChannel: true });
      }
      await app.db.execute(
        "INSERT INTO modmail_threads (guild_id, thread_id, user_id, status) VALUES (?, ?, ?, 'open')",
        [guild.id, thread.id, message.author.id],
      );
      await thread.send({ content: `Modmail from <@${message.author.id}> — staff replies here will be relayed back.` });
      await app.db.execute('INSERT INTO modmail_messages (user_id, author_id, content, direction) VALUES (?, ?, ?, ?)', [
        message.author.id,
        message.author.id,
        message.content,
        'in',
      ]);
    } else {
      const threadId = String(rows[0].thread_id);
      const thread = guild.channels.cache.get(threadId);
      if (thread && 'send' in thread) {
        await thread.send({ content: `**<@${message.author.id}>:** ${message.content}` });
      }
      await app.db.execute('INSERT INTO modmail_messages (user_id, author_id, content, direction) VALUES (?, ?, ?, ?)', [
        message.author.id,
        message.author.id,
        message.content,
        'in',
      ]);
    }
    await message.reply({ content: 'Your message has been forwarded to staff.' }).catch(() => undefined);
  } catch (err) {
    app.logger.error('modmail DM handler threw:', err);
  }
}

export default { name: 'messageCreate', run: handleMessageCreateDM };