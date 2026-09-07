import { SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction, Message } from 'discord.js';
import type { App } from '../../core/context';
import type { BotCommand } from '../../types/command';
import { v2Reply } from '../../utils/v2';
import { v2MessageReply } from '../../utils/v2';

const data = new SlashCommandBuilder()
  .setName('buy')
  .setDescription('Buy an item from the shop')
  .addStringOption((o) => o.setName('item').setDescription('Item to buy').setRequired(true).setAutocomplete(true))
  .addIntegerOption((o) => o.setName('quantity').setDescription('Amount to buy').setMinValue(1).setMaxValue(99).setRequired(false));

async function execute(interaction: ChatInputCommandInteraction, app: App): Promise<void> {
  await interaction.deferReply();
  if (!app.economy.isEnabled(interaction.guildId!)) { await v2Reply(interaction, 'Economy is not enabled.'); return; }
  const itemSlug = interaction.options.getString('item', true);
  const qty = interaction.options.getInteger('quantity') ?? 1;
  const idempKey = `buy:${interaction.guildId}:${interaction.user.id}:${itemSlug}:${qty}:${Math.floor(Date.now() / 30000)}`;
  const result = await app.economy.items.purchaseItem(interaction.guildId!, interaction.user.id, itemSlug, qty, idempKey);
  if (!result.success) { await v2Reply(interaction, result.error ?? 'Purchase failed.'); return; }
  await v2Reply(interaction, `Purchased **${qty}x ${result.item!.name}** for **${app.economy.formatCurrency(result.totalCost!)}**.`);
}

async function prefixExecute(message: Message, args: string[], app: App): Promise<void> {
  if (!app.economy.isEnabled(message.guildId!)) { await v2MessageReply(message, { content: 'Economy is not enabled.' }); return; }
  if (!args[0]) { await v2MessageReply(message, { content: 'Usage: `buy <item> [quantity]`' }); return; }
  const itemSlug = args[0];
  const qty = parseInt(args[1] ?? '1', 10) || 1;
  const idempKey = `buy:${message.guildId}:${message.author.id}:${itemSlug}:${qty}:${Math.floor(Date.now() / 30000)}`;
  const result = await app.economy.items.purchaseItem(message.guildId!, message.author.id, itemSlug, qty, idempKey);
  if (!result.success) { await v2MessageReply(message, { content: result.error ?? 'Purchase failed.' }); return; }
  await v2MessageReply(message, { content: `Purchased **${qty}x ${result.item!.name}** for **${app.economy.formatCurrency(result.totalCost!)}**.` });
}

const command: BotCommand = {
  name: 'buy',
  category: 'community',
  description: 'Buy an item from the shop',
  data,
  aliases: ['purchase'],
  execute,
  prefixExecute,
};

export default command;
