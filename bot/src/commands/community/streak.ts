import { SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction, Message } from 'discord.js';
import type { App } from '../../core/context';
import type { BotCommand } from '../../types/command';
import { v2Reply } from '../../utils/v2';
import { v2MessageReply } from '../../utils/v2';
import type { RowDataPacket } from 'mysql2/promise';

const data = new SlashCommandBuilder()
  .setName('streak')
  .setDescription('View your reward streaks')
  .addUserOption((o) => o.setName('user').setDescription('View another user\'s streaks').setRequired(false));

async function execute(interaction: ChatInputCommandInteraction, app: App): Promise<void> {
  await interaction.deferReply();
  if (!app.economy.isEnabled(interaction.guildId!)) { await v2Reply(interaction, 'Economy is not enabled.'); return; }
  const target = interaction.options.getUser('user') ?? interaction.user;
  const profile = await app.economy.getProfile(interaction.guildId!, target.id);

  const lines = [
    `**${target.username}'s Streaks**`,
    ``,
    `**Daily Streak:** ${profile.daily_streak} day${profile.daily_streak !== 1 ? 's' : ''}`,
    profile.last_daily_at ? `  Last claim: <t:${Math.floor(new Date(profile.last_daily_at).getTime() / 1000)}:R>` : '  No daily claimed yet',
    ``,
    `**Weekly Streak:** ${profile.weekly_streak} week${profile.weekly_streak !== 1 ? 's' : ''}`,
    profile.last_weekly_at ? `  Last claim: <t:${Math.floor(new Date(profile.last_weekly_at).getTime() / 1000)}:R>` : '  No weekly claimed yet',
  ].join('\n');
  await v2Reply(interaction, lines);
}

async function prefixExecute(message: Message, args: string[], app: App): Promise<void> {
  if (!app.economy.isEnabled(message.guildId!)) { await v2MessageReply(message, { content: 'Economy is not enabled.' }); return; }
  const targetId = args[0]?.replace(/[<@!>]/g, '') || message.author.id;
  const target = await app.client.users.fetch(targetId).catch(() => null);
  if (!target) { await v2MessageReply(message, { content: 'User not found.' }); return; }
  const profile = await app.economy.getProfile(message.guildId!, target.id);
  const lines = [
    `**${target.username}'s Streaks**`,
    `Daily: **${profile.daily_streak}** day${profile.daily_streak !== 1 ? 's' : ''}`,
    `Weekly: **${profile.weekly_streak}** week${profile.weekly_streak !== 1 ? 's' : ''}`,
  ].join('\n');
  await v2MessageReply(message, { content: lines });
}

const command: BotCommand = {
  name: 'streak',
  category: 'community',
  description: 'View reward streaks',
  data,
  execute,
  prefixExecute,
};

export default command;
