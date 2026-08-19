import { SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction, Message } from 'discord.js';
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import type { App } from '../../core/context';
import type { BotCommand } from '../../types/command';
import { v2Reply } from '../../utils/v2';
import { v2MessageReply } from '../../utils/v2';

const data = new SlashCommandBuilder()
  .setName('afk')
  .setDescription('Set or clear your AFK status')
  .addStringOption((o) => o.setName('reason').setDescription('AFK reason').setRequired(false))
  .addBooleanOption((o) =>
    o
      .setName('autoremove')
      .setDescription('Auto-remove AFK and list mentions when you return (default: true)')
      .setRequired(false),
  );

async function setAfk(app: App, userId: string, guildId: string, reason: string | null, autoremove: boolean): Promise<void> {
  const [rows] = await app.db.query<RowDataPacket[]>(
    'SELECT id FROM afk WHERE user_id = ? AND guild_id = ? AND cleared = 0 LIMIT 1',
    [userId, guildId],
  );
  if (rows.length > 0) {
    await app.db.execute(
      'UPDATE afk SET reason = ?, autoremove = ?, since = NOW(), cleared = 0 WHERE user_id = ? AND guild_id = ? AND cleared = 0',
      [reason, autoremove ? 1 : 0, userId, guildId],
    );
  } else {
    await app.db.execute('INSERT INTO afk (user_id, guild_id, reason, autoremove) VALUES (?, ?, ?, ?)', [
      userId,
      guildId,
      reason,
      autoremove ? 1 : 0,
    ]);
  }
}

async function clearAfk(app: App, userId: string, guildId: string): Promise<boolean> {
  const [result] = await app.db.execute<ResultSetHeader>(
    'UPDATE afk SET cleared = 1 WHERE user_id = ? AND guild_id = ? AND cleared = 0',
    [userId, guildId],
  );
  if (result.affectedRows > 0) {
    await app.db.execute('DELETE FROM afk_mentions WHERE guild_id = ? AND user_id = ?', [guildId, userId]).catch(() => undefined);
    return true;
  }
  return false;
}

function parsePrefixArgs(args: string[]): { reason: string | null; autoremove: boolean } {
  const tokens = [...args];
  let autoremove = true;
  if (tokens.length > 0 && tokens[tokens.length - 1].toLowerCase() === 'false') {
    autoremove = false;
    tokens.pop();
  }
  const reason = tokens.join(' ') || null;
  return { reason, autoremove };
}

async function execute(interaction: ChatInputCommandInteraction, app: App): Promise<void> {
  const guild = interaction.guild;
  if (!guild) return;
  const reason = interaction.options.getString('reason');
  const autoremove = interaction.options.getBoolean('autoremove') ?? true;
  if (reason) {
    await setAfk(app, interaction.user.id, guild.id, reason, autoremove);
    await v2Reply(interaction, `AFK set: ${reason}${autoremove ? '' : ' (autoremove disabled)'}`);
  } else if (await clearAfk(app, interaction.user.id, guild.id)) {
    await v2Reply(interaction, 'AFK cleared.');
  } else {
    await setAfk(app, interaction.user.id, guild.id, null, autoremove);
    await v2Reply(interaction, `You're now AFK.${autoremove ? '' : ' (autoremove disabled)'}`);
  }
}

async function prefixExecute(message: Message, args: string[], app: App): Promise<void> {
  const guild = message.guild;
  if (!guild) return;
  const { reason, autoremove } = parsePrefixArgs(args);
  if (reason) {
    await setAfk(app, message.author.id, guild.id, reason, autoremove);
    await v2MessageReply(message, { content: `AFK set: ${reason}${autoremove ? '' : ' (autoremove disabled)'}` });
  } else if (await clearAfk(app, message.author.id, guild.id)) {
    await v2MessageReply(message, { content: 'AFK cleared.' });
  } else {
    await setAfk(app, message.author.id, guild.id, null, autoremove);
    await v2MessageReply(message, { content: `You're now AFK.${autoremove ? '' : ' (autoremove disabled)'}` });
  }
}

const command: BotCommand = {
  name: 'afk',
  category: 'utility',
  description: 'Set or clear your AFK status',
  data,
  permissions: [],
  aliases: [],
  execute,
  prefixExecute,
};

export default command;
