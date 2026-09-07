import { SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction, Message } from 'discord.js';
import type { App } from '../../core/context';
import type { BotCommand } from '../../types/command';
import { v2Reply } from '../../utils/v2';
import { v2MessageReply } from '../../utils/v2';

const data = new SlashCommandBuilder()
  .setName('sell')
  .setDescription('Sell an item from your inventory')
  .addStringOption((o) => o.setName('item').setDescription('Item to sell').setRequired(true).setAutocomplete(true))
  .addIntegerOption((o) => o.setName('quantity').setDescription('Amount to sell').setMinValue(1).setMaxValue(99).setRequired(false));

async function execute(interaction: ChatInputCommandInteraction, app: App): Promise<void> {
  await interaction.deferReply();
  if (!app.economy.isEnabled(interaction.guildId!)) { await v2Reply(interaction, 'Economy is not enabled.'); return; }
  const itemSlug = interaction.options.getString('item', true);
  const qty = interaction.options.getInteger('quantity') ?? 1;
  const idempKey = `sell:${interaction.guildId}:${interaction.user.id}:${itemSlug}:${qty}:${Math.floor(Date.now() / 30000)}`;
  const result = await app.economy.items.sellItem(interaction.guildId!, interaction.user.id, itemSlug, qty, idempKey);
  if (!result.success) { await v2Reply(interaction, result.error ?? 'Sale failed.'); return; }
  await v2Reply(interaction, `Sold **${qty}x ${itemSlug}** for **${app.economy.formatCurrency(result.totalValue!)}**.`);
}

async function prefixExecute(message: Message, args: string[], app: App): Promise<void> {
  if (!app.economy.isEnabled(message.guildId!)) { await v2MessageReply(message, { content: 'Economy is not enabled.' }); return; }
  if (!args[0]) { await v2MessageReply(message, { content: 'Usage: `sell <item> [quantity]`' }); return; }
  const itemSlug = args[0];
  const qty = parseInt(args[1] ?? '1', 10) || 1;
  const idempKey = `sell:${message.guildId}:${message.author.id}:${itemSlug}:${qty}:${Math.floor(Date.now() / 30000)}`;
  const result = await app.economy.items.sellItem(message.guildId!, message.author.id, itemSlug, qty, idempKey);
  if (!result.success) { await v2MessageReply(message, { content: result.error ?? 'Sale failed.' }); return; }
  await v2MessageReply(message, { content: `Sold **${qty}x ${itemSlug}** for **${app.economy.formatCurrency(result.totalValue!)}**.` });
}

const command: BotCommand = {
  name: 'sell',
  category: 'community',
  description: 'Sell an item from your inventory',
  data,
  aliases: ['sellitem'],
  execute,
  prefixExecute,
};

export default command;
