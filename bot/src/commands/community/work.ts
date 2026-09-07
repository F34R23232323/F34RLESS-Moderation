import { SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction, Message } from 'discord.js';
import type { App } from '../../core/context';
import type { BotCommand } from '../../types/command';
import { v2Reply } from '../../utils/v2';
import { v2MessageReply } from '../../utils/v2';

const data = new SlashCommandBuilder()
  .setName('work')
  .setDescription('Work to earn coins')
  .addStringOption((o) => o.setName('job').setDescription('Job to work at').setRequired(false).setAutocomplete(true));

async function execute(interaction: ChatInputCommandInteraction, app: App): Promise<void> {
  await interaction.deferReply();
  if (!app.economy.isEnabled(interaction.guildId!)) { await v2Reply(interaction, 'Economy is not enabled.'); return; }
  const jobSlug = interaction.options.getString('job') ?? undefined;
  const idempKey = `work:${interaction.guildId}:${interaction.user.id}:${jobSlug ?? 'general'}:${Math.floor(Date.now() / 60000)}`;
  const result = await app.economy.rewards.work(interaction.guildId!, interaction.user.id, jobSlug, idempKey);
  if (!result.success) { await v2Reply(interaction, result.error ?? 'Failed.'); return; }
  const text = [
    `**Work Complete!** ${result.job?.emoji ?? ''}`,
    `You earned **${app.economy.formatCurrency(result.amount!)}**${result.job ? ` as a ${result.job.name}` : ''}`,
    result.xp ? `+${result.xp} XP` : '',
  ].filter(Boolean).join('\n');
  await v2Reply(interaction, text);
}

async function prefixExecute(message: Message, args: string[], app: App): Promise<void> {
  if (!app.economy.isEnabled(message.guildId!)) { await v2MessageReply(message, { content: 'Economy is not enabled.' }); return; }
  const jobSlug = args[0] || undefined;
  const idempKey = `work:${message.guildId}:${message.author.id}:${jobSlug ?? 'general'}:${Math.floor(Date.now() / 60000)}`;
  const result = await app.economy.rewards.work(message.guildId!, message.author.id, jobSlug, idempKey);
  if (!result.success) { await v2MessageReply(message, { content: result.error ?? 'Failed.' }); return; }
  const text = `**Work Complete!** ${result.job?.emoji ?? ''}\nYou earned **${app.economy.formatCurrency(result.amount!)}**`;
  await v2MessageReply(message, { content: text });
}

const command: BotCommand = {
  name: 'work',
  category: 'community',
  description: 'Work to earn coins',
  data,
  aliases: ['wrk', 'workjob'],
  execute,
  prefixExecute,
};

export default command;
