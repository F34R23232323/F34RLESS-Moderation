import { SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction, Message } from 'discord.js';
import type { RowDataPacket } from 'mysql2/promise';
import type { App } from '../../core/context';
import type { BotCommand } from '../../types/command';
import { v2Reply } from '../../utils/v2';
import { v2MessageReply } from '../../utils/v2';

async function leaderboardLines(app: App, guildId: string, limit: number): Promise<string | null> {
  const [rows] = await app.db.query<RowDataPacket[]>(
    'SELECT user_id, xp, level FROM levels WHERE guild_id = ? ORDER BY xp DESC LIMIT ?',
    [guildId, Math.min(limit, 50)],
  );
  if (rows.length === 0) return null;
  const lines = rows.map((r, i) => `${i + 1}. <@${r.user_id}> — level ${r.level} (${r.xp} XP)`);
  return `**Leaderboard**\n${lines.join('\n')}`;
}

const data = new SlashCommandBuilder()
  .setName('leaderboard')
  .setDescription('Level leaderboard')
  .addIntegerOption((o) => o.setName('limit').setDescription('How many to show').setMinValue(1).setMaxValue(50).setRequired(false));

async function execute(interaction: ChatInputCommandInteraction, app: App): Promise<void> {
  await interaction.deferReply();
  const guild = interaction.guild;
  if (!guild) return;
  const limit = interaction.options.getInteger('limit') ?? 10;
  const text = await leaderboardLines(app, guild.id, limit);
  await v2Reply(interaction, text ?? 'No level data yet.');
}

async function prefixExecute(message: Message, args: string[], app: App): Promise<void> {
  const guild = message.guild;
  if (!guild) return;
  const limit = args[0] ? parseInt(args[0], 10) : 10;
  const text = await leaderboardLines(app, guild.id, Number.isNaN(limit) ? 10 : limit);
  await v2MessageReply(message, { content: text ?? 'No level data yet.' });
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