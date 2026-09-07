import { SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction, Message } from 'discord.js';
import type { App } from '../../core/context';
import type { BotCommand } from '../../types/command';
import { v2Reply } from '../../utils/v2';
import { v2MessageReply } from '../../utils/v2';

const data = new SlashCommandBuilder()
  .setName('weekly')
  .setDescription('Claim your weekly reward');

async function execute(interaction: ChatInputCommandInteraction, app: App): Promise<void> {
  await interaction.deferReply();
  if (!app.economy.isEnabled(interaction.guildId!)) { await v2Reply(interaction, 'Economy is not enabled.'); return; }
  const idempKey = `weekly:${interaction.guildId}:${interaction.user.id}:${Math.floor(Date.now() / 600000)}`;
  const result = await app.economy.rewards.claimWeekly(interaction.guildId!, interaction.user.id, idempKey);
  if (!result.success) { await v2Reply(interaction, result.error ?? 'Failed to claim weekly.'); return; }
  const text = [
    `**Weekly Reward Claimed!**`,
    `You received **${app.economy.formatCurrency(result.amount!)}**`,
    result.streak && result.streak > 1 ? `Streak: **${result.streak} weeks** (${result.bonus ? `+${app.economy.formatCurrency(result.bonus)} bonus` : ''})` : '',
  ].filter(Boolean).join('\n');
  await v2Reply(interaction, text);
}

async function prefixExecute(message: Message, _args: string[], app: App): Promise<void> {
  if (!app.economy.isEnabled(message.guildId!)) { await v2MessageReply(message, { content: 'Economy is not enabled.' }); return; }
  const idempKey = `weekly:${message.guildId}:${message.author.id}:${Math.floor(Date.now() / 600000)}`;
  const result = await app.economy.rewards.claimWeekly(message.guildId!, message.author.id, idempKey);
  if (!result.success) { await v2MessageReply(message, { content: result.error ?? 'Failed to claim weekly.' }); return; }
  const text = `**Weekly Reward Claimed!**\nYou received **${app.economy.formatCurrency(result.amount!)}**`;
  await v2MessageReply(message, { content: text });
}

const command: BotCommand = {
  name: 'weekly',
  category: 'community',
  description: 'Claim your weekly reward',
  data,
  aliases: ['wkly', 'wk'],
  execute,
  prefixExecute,
};

export default command;
