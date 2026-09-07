import { SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction, Message } from 'discord.js';
import type { App } from '../../core/context';
import type { BotCommand } from '../../types/command';
import { v2Reply } from '../../utils/v2';
import { v2MessageReply } from '../../utils/v2';

const data = new SlashCommandBuilder()
  .setName('deposit')
  .setDescription('Deposit coins into your bank')
  .addStringOption((o) => o.setName('amount').setDescription('Amount (number, all, half)').setRequired(true));

async function execute(interaction: ChatInputCommandInteraction, app: App): Promise<void> {
  await interaction.deferReply();
  if (!app.economy.isEnabled(interaction.guildId!)) { await v2Reply(interaction, 'Economy is not enabled.'); return; }
  if (!app.config.economy.banking.enabled) { await v2Reply(interaction, 'Banking is disabled.'); return; }
  const profile = await app.economy.getProfile(interaction.guildId!, interaction.user.id);
  const amount = app.economy.parseAmount(interaction.options.getString('amount', true), profile.wallet);
  if (amount === null || amount <= 0) { await v2Reply(interaction, 'Invalid amount.'); return; }
  const idempKey = `deposit:${interaction.guildId}:${interaction.user.id}:${amount}:${Date.now()}`;
  const result = await app.economy.ledger.deposit(interaction.guildId!, interaction.user.id, amount, idempKey);
  if (!result.success) { await v2Reply(interaction, 'Insufficient wallet balance.'); return; }
  await v2Reply(interaction, `Deposited **${app.economy.formatCurrency(amount)}**.\nWallet: ${app.economy.formatCurrency(result.wallet)} | Bank: ${app.economy.formatCurrency(result.bank)}`);
}

async function prefixExecute(message: Message, args: string[], app: App): Promise<void> {
  if (!app.economy.isEnabled(message.guildId!)) { await v2MessageReply(message, { content: 'Economy is not enabled.' }); return; }
  if (!app.config.economy.banking.enabled) { await v2MessageReply(message, { content: 'Banking is disabled.' }); return; }
  const profile = await app.economy.getProfile(message.guildId!, message.author.id);
  const amount = app.economy.parseAmount(args[0] ?? 'all', profile.wallet);
  if (amount === null || amount <= 0) { await v2MessageReply(message, { content: 'Invalid amount.' }); return; }
  const idempKey = `deposit:${message.guildId}:${message.author.id}:${amount}:${Date.now()}`;
  const result = await app.economy.ledger.deposit(message.guildId!, message.author.id, amount, idempKey);
  if (!result.success) { await v2MessageReply(message, { content: 'Insufficient wallet balance.' }); return; }
  await v2MessageReply(message, { content: `Deposited **${app.economy.formatCurrency(amount)}**.\nWallet: ${app.economy.formatCurrency(result.wallet)} | Bank: ${app.economy.formatCurrency(result.bank)}` });
}

const command: BotCommand = {
  name: 'deposit',
  category: 'community',
  description: 'Deposit coins into your bank',
  data,
  aliases: ['dep', 'bankdeposit'],
  execute,
  prefixExecute,
};

export default command;
