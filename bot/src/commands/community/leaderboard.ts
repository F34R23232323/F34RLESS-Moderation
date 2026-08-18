import { SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction, Message } from 'discord.js';
import type { RowDataPacket } from 'mysql2/promise';
import type { App } from '../../core/context';
import type { BotCommand } from '../../types/command';
import { v2Reply } from '../../utils/v2';

const data = new SlashCommandBuilder()
  .setName('leaderboard')
  .setDescription('Level leaderboard')
  .addIntegerOption((o) => o.setName('limit').setDescription('How many to show').setMinValue(1).setMaxValue(50).setRequired(false));

async function execute(interaction: ChatInputCommandInteraction, app: App): Promise<void> {
  await interaction.deferReply();
  const guild = interaction.guild;
  if (!guild) return;
  const limit = interaction.options.getInteger('limit') ?? 10;
  const [rows] = await app.db.query<RowDataPacket[]>(
    'SELECT user_id, xp, level FROM levels WHERE guild_id = ? ORDER BY xp DESC LIMIT ?',
    [guild.id, limit],
  );
  if (rows.length === 0) {
    await v2Reply(interaction, 'No level data yet.');
    return;
  }
  const lines = rows.map((r, i) => `${i + 1}. <@${r.user_id}> — level ${r.level} (${r.xp} XP)`);
  await v2Reply(interaction, `**Leaderboard**\n${lines.join('\n')}`);
}

async function prefixExecute(message: Message, args: string[], app: App): Promise<void> {
  const guild = message.guild;
  if (!guild) return;
  const [rows] = await app.db.query<RowDataPacket[]>(
    'SELECT user_id, xp, level FROM levels WHERE guild_id = ? ORDER BY xp DESC LIMIT 10',
    [guild.id],
  );
  await message.reply({ content: rows.length === 0 ? 'No level data yet.' : `**Leaderboard**\n${rows.map((r, i) => `${i + 1}. <@${r.user_id}> — level ${r.level}`).join('\n')}` });
}

const command: BotCommand = {
  name: 'leaderboard',
  category: 'community',
  description: 'Level leaderboard',
  data,
  permissions: [],
  aliases: ['lb'],
  execute,
  prefixExecute,
};

export default command;