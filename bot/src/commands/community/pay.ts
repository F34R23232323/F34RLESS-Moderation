import { SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction, Message } from 'discord.js';
import type { App } from '../../core/context';
import type { BotCommand } from '../../types/command';
import { v2Reply } from '../../utils/v2';
import { v2MessageReply } from '../../utils/v2';

const data = new SlashCommandBuilder()
  .setName('pay')
  .setDescription('Send coins to another user')
  .addUserOption((o) => o.setName('user').setDescription('Recipient').setRequired(true))
  .addStringOption((o) => o.setName('amount').setDescription('Amount (number, all, half, or %)').setRequired(true));

async function execute(interaction: ChatInputCommandInteraction, app: App): Promise<void> {
  await interaction.deferReply();
  if (!app.economy.isEnabled(interaction.guildId!)) { await v2Reply(interaction, 'Economy is not enabled.'); return; }
  const target = interaction.options.getUser('user', true);
  if (target.id === interaction.user.id) { await v2Reply(interaction, 'Cannot pay yourself.'); return; }
  if (target.bot) { await v2Reply(interaction, 'Cannot pay bots.'); return; }
  const profile = await app.economy.getProfile(interaction.guildId!, interaction.user.id);
  const amount = app.economy.parseAmount(interaction.options.getString('amount', true), profile.wallet);
  if (amount === null || amount <= 0) { await v2Reply(interaction, 'Invalid amount.'); return; }
  const ec = app.config.economy.transfers;
  const fee = Math.floor((amount * ec.fee_percentage_bps) / 10000);
  const idempKey = `pay:${interaction.guildId}:${interaction.user.id}:${target.id}:${amount}:${Date.now()}`;
  const result = await app.economy.ledger.transfer(interaction.guildId!, interaction.user.id, target.id, amount, { fee, idempotencyKey: idempKey });
  if (!result.success) { await v2Reply(interaction, 'Insufficient funds.'); return; }
  const feeText = fee > 0 ? ` (fee: ${app.economy.formatCurrency(fee)})` : '';
  await v2Reply(interaction, `Sent **${app.economy.formatCurrency(amount)}** to ${target}${feeText}.`);
}

async function prefixExecute(message: Message, args: string[], app: App): Promise<void> {
  if (!app.economy.isEnabled(message.guildId!)) { await v2MessageReply(message, { content: 'Economy is not enabled.' }); return; }
  if (!args[0] || !args[1]) { await v2MessageReply(message, { content: 'Usage: `pay <user> <amount>`' }); return; }
  const targetId = args[0].replace(/[<@!>]/g, '');
  const target = await app.client.users.fetch(targetId).catch(() => null);
  if (!target) { await v2MessageReply(message, { content: 'User not found.' }); return; }
  if (target.id === message.author.id) { await v2MessageReply(message, { content: 'Cannot pay yourself.' }); return; }
  if (target.bot) { await v2MessageReply(message, { content: 'Cannot pay bots.' }); return; }
  const profile = await app.economy.getProfile(message.guildId!, message.author.id);
  const amount = app.economy.parseAmount(args[1], profile.wallet);
  if (amount === null || amount <= 0) { await v2MessageReply(message, { content: 'Invalid amount.' }); return; }
  const fee = Math.floor((amount * app.config.economy.transfers.fee_percentage_bps) / 10000);
  const idempKey = `pay:${message.guildId}:${message.author.id}:${target.id}:${amount}:${Date.now()}`;
  const result = await app.economy.ledger.transfer(message.guildId!, message.author.id, target.id, amount, { fee, idempotencyKey: idempKey });
  if (!result.success) { await v2MessageReply(message, { content: 'Insufficient funds.' }); return; }
  await v2MessageReply(message, { content: `Sent **${app.economy.formatCurrency(amount)}** to ${target}${fee > 0 ? ` (fee: ${app.economy.formatCurrency(fee)})` : ''}.` });
}

const command: BotCommand = {
  name: 'pay',
  category: 'community',
  description: 'Send coins to another user',
  data,
  aliases: ['transfer', 'send'],
  execute,
  prefixExecute,
};

export default command;
