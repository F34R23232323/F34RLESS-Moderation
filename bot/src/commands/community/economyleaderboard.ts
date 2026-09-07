import { SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction, Message } from 'discord.js';
import type { App } from '../../core/context';
import type { BotCommand } from '../../types/command';
import { v2Reply } from '../../utils/v2';
import { v2MessageReply } from '../../utils/v2';

const CATEGORIES = ['net_worth', 'wallet', 'bank', 'total_earned', 'level', 'daily_streak'];

const data = new SlashCommandBuilder()
  .setName('economyleaderboard')
  .setDescription('View the economy leaderboard')
  .addStringOption((o) => o.setName('category').setDescription('Leaderboard category').setRequired(false));

async function execute(interaction: ChatInputCommandInteraction, app: App): Promise<void> {
  await interaction.deferReply();
  if (!app.economy.isEnabled(interaction.guildId!)) { await v2Reply(interaction, 'Economy is not enabled.'); return; }
  const category = (interaction.options.getString('category') ?? 'net_worth').toLowerCase();
  const entries = await app.economy.leaderboards.getLeaderboard(interaction.guildId!, category, { limit: 15 });
  if (entries.length === 0) { await v2Reply(interaction, 'No economy data yet.'); return; }
  const lines = entries.map((e) => `\`${e.rank}.\` <@${e.user_id}> — ${app.economy.formatCurrency(e.value)}`);
  await v2Reply(interaction, `**Economy Leaderboard — ${category.replace('_', ' ')}**\n${lines.join('\n')}`);
}

async function prefixExecute(message: Message, args: string[], app: App): Promise<void> {
  if (!app.economy.isEnabled(message.guildId!)) { await v2MessageReply(message, { content: 'Economy is not enabled.' }); return; }
  const category = (args[0] ?? 'net_worth').toLowerCase();
  const entries = await app.economy.leaderboards.getLeaderboard(message.guildId!, category, { limit: 15 });
  if (entries.length === 0) { await v2MessageReply(message, { content: 'No economy data yet.' }); return; }
  const lines = entries.map((e) => `\`${e.rank}.\` <@${e.user_id}> — ${app.economy.formatCurrency(e.value)}`);
  await v2MessageReply(message, { content: `**Economy Leaderboard — ${category.replace('_', ' ')}**\n${lines.join('\n')}` });
}

const command: BotCommand = {
  name: 'economyleaderboard',
  category: 'community',
  description: 'View the economy leaderboard',
  data,
  aliases: ['elb', 'etop', 'erich'],
  execute,
  prefixExecute,
};

export default command;
