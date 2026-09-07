import { SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction, Message } from 'discord.js';
import type { App } from '../../core/context';
import type { BotCommand } from '../../types/command';
import { v2Reply, buildRichV2 } from '../../utils/v2';
import { v2MessageReply } from '../../utils/v2';

const data = new SlashCommandBuilder()
  .setName('balance')
  .setDescription('Check your economy balance')
  .addUserOption((o) => o.setName('user').setDescription('Check another user\'s balance').setRequired(false));

async function execute(interaction: ChatInputCommandInteraction, app: App): Promise<void> {
  await interaction.deferReply();
  if (!app.economy.isEnabled(interaction.guildId!)) {
    await v2Reply(interaction, 'Economy is not enabled in this server.');
    return;
  }
  const target = interaction.options.getUser('user') ?? interaction.user;
  const profile = await app.economy.getProfile(interaction.guildId!, target.id);
  const total = profile.wallet + profile.bank;
  const text = [
    `**${target.username}'s Balance**`,
    `**Wallet:** ${app.economy.formatCurrency(profile.wallet)}`,
    `**Bank:** ${app.economy.formatCurrency(profile.bank)}`,
    `**Total:** ${app.economy.formatCurrency(total)}`,
    `**Level:** ${profile.level} (${profile.xp} XP)`,
    `**Job:** ${profile.job_id ?? 'Unemployed'}`,
  ].join('\n');
  await v2Reply(interaction, text);
}

async function prefixExecute(message: Message, args: string[], app: App): Promise<void> {
  if (!app.economy.isEnabled(message.guildId!)) {
    await v2MessageReply(message, { content: 'Economy is not enabled in this server.' });
    return;
  }
  const targetId = args[0]?.replace(/[<@!>]/g, '') || message.author.id;
  const target = await app.client.users.fetch(targetId).catch(() => null);
  if (!target) {
    await v2MessageReply(message, { content: 'User not found.' });
    return;
  }
  const profile = await app.economy.getProfile(message.guildId!, target.id);
  const total = profile.wallet + profile.bank;
  const text = [
    `**${target.username}'s Balance**`,
    `**Wallet:** ${app.economy.formatCurrency(profile.wallet)}`,
    `**Bank:** ${app.economy.formatCurrency(profile.bank)}`,
    `**Total:** ${app.economy.formatCurrency(total)}`,
    `**Level:** ${profile.level} (${profile.xp} XP)`,
    `**Job:** ${profile.job_id ?? 'Unemployed'}`,
  ].join('\n');
  await v2MessageReply(message, { content: text });
}

const command: BotCommand = {
  name: 'balance',
  category: 'community',
  description: 'Check your economy balance',
  data,
  aliases: ['bal', 'wallet', 'money'],
  execute,
  prefixExecute,
};

export default command;
