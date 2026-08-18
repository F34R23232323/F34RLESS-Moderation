import { SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction, Message } from 'discord.js';
import type { App } from '../../core/context';
import type { BotCommand } from '../../types/command';
import { v2Reply } from '../../utils/v2';

const data = new SlashCommandBuilder()
  .setName('afk')
  .setDescription('Set or clear your AFK status')
  .addStringOption((o) => o.setName('reason').setDescription('AFK reason').setRequired(false));

async function execute(interaction: ChatInputCommandInteraction, app: App): Promise<void> {
  const guild = interaction.guild;
  if (!guild) return;
  const reason = interaction.options.getString('reason');
  if (reason) {
    await app.db.execute(
      `INSERT INTO afk (user_id, guild_id, reason) VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE reason = VALUES(reason), since = NOW(), cleared = 0`,
      [interaction.user.id, guild.id, reason],
    );
    await v2Reply(interaction, `AFK set: ${reason}`);
  } else {
    await app.db.execute('UPDATE afk SET cleared = 1 WHERE user_id = ? AND guild_id = ?', [interaction.user.id, guild.id]);
    await v2Reply(interaction, 'AFK cleared.');
  }
}

async function prefixExecute(message: Message, args: string[], app: App): Promise<void> {
  const guild = message.guild;
  if (!guild) return;
  const reason = args.join(' ');
  if (reason) {
    await app.db.execute(
      `INSERT INTO afk (user_id, guild_id, reason) VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE reason = VALUES(reason), since = NOW(), cleared = 0`,
      [message.author.id, guild.id, reason],
    );
    await message.reply({ content: `AFK set: ${reason}` });
  } else {
    await app.db.execute('UPDATE afk SET cleared = 1 WHERE user_id = ? AND guild_id = ?', [message.author.id, guild.id]);
    await message.reply({ content: 'AFK cleared.' });
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