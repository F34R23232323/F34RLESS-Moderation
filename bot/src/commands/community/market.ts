import { SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction, Message } from 'discord.js';
import type { App } from '../../core/context';
import type { BotCommand } from '../../types/command';
import { v2Reply } from '../../utils/v2';
import { v2MessageReply } from '../../utils/v2';
import type { RowDataPacket } from 'mysql2/promise';

const data = new SlashCommandBuilder()
  .setName('market')
  .setDescription('Browse or list items on the marketplace')
  .addSubcommand((sub) => sub.setName('browse').setDescription('Browse marketplace listings')
    .addStringOption((o) => o.setName('item').setDescription('Filter by item').setRequired(false)))
  .addSubcommand((sub) => sub.setName('sell').setDescription('List an item for sale')
    .addStringOption((o) => o.setName('item').setDescription('Item to list').setRequired(true))
    .addIntegerOption((o) => o.setName('price').setDescription('Price per unit').setMinValue(1).setRequired(true))
    .addIntegerOption((o) => o.setName('quantity').setDescription('Quantity').setMinValue(1).setRequired(false)))
  .addSubcommand((sub) => sub.setName('buy').setDescription('Buy a listing')
    .addIntegerOption((o) => o.setName('id').setDescription('Listing ID').setRequired(true)))
  .addSubcommand((sub) => sub.setName('cancel').setDescription('Cancel your listing')
    .addIntegerOption((o) => o.setName('id').setDescription('Listing ID').setRequired(true)))
  .addSubcommand((sub) => sub.setName('listings').setDescription('View your active listings'));

async function execute(interaction: ChatInputCommandInteraction, app: App): Promise<void> {
  await interaction.deferReply();
  if (!app.economy.isEnabled(interaction.guildId!)) { await v2Reply(interaction, 'Economy is not enabled.'); return; }
  if (!app.config.economy.marketplace.enabled) { await v2Reply(interaction, 'Marketplace is disabled.'); return; }

  const sub = interaction.options.getSubcommand();
  const guildId = interaction.guildId!;
  const userId = interaction.user.id;

  if (sub === 'browse') {
    const itemFilter = interaction.options.getString('item');
    const listings = await app.economy.marketplace.browse(guildId, { itemSlug: itemFilter ?? undefined, limit: 15 });
    if (listings.length === 0) { await v2Reply(interaction, 'No active listings found.'); return; }
    const lines = listings.map((l: any) => `\`${l.id}\` ${l.item_emoji ?? ''} **${l.item_name}** x${l.quantity} — ${app.economy.formatCurrency(l.price_per_unit)}/ea (Seller: <@${l.seller_id}>)`);
    await v2Reply(interaction, `**Marketplace** (${listings.length} listings)\n\n${lines.join('\n')}\n\nUse \`/market buy id:<id>\` to purchase.`);
  } else if (sub === 'sell') {
    const itemSlug = interaction.options.getString('item', true);
    const qty = interaction.options.getInteger('quantity') ?? 1;
    const price = interaction.options.getInteger('price', true);
    const result = await app.economy.marketplace.createListing(guildId, userId, itemSlug, qty, price);
    if (!result.success) { await v2Reply(interaction, result.error ?? 'Failed to list.'); return; }
    await v2Reply(interaction, `Listed **${qty}x ${itemSlug}** at **${app.economy.formatCurrency(price)}/ea** (Listing #${result.listingId})`);
  } else if (sub === 'buy') {
    const listingId = interaction.options.getInteger('id', true);
    const result = await app.economy.marketplace.purchaseListing(guildId, userId, listingId);
    if (!result.success) { await v2Reply(interaction, result.error ?? 'Purchase failed.'); return; }
    await v2Reply(interaction, `Purchase complete! Paid **${app.economy.formatCurrency(result.totalCost!)}**.`);
  } else if (sub === 'cancel') {
    const listingId = interaction.options.getInteger('id', true);
    const result = await app.economy.marketplace.cancelListing(guildId, userId, listingId);
    await v2Reply(interaction, result.success ? 'Listing cancelled. Items returned.' : (result.error ?? 'Failed.'));
  } else if (sub === 'listings') {
    const [rows] = await app.db.query<RowDataPacket[]>(
      `SELECT ml.*, ei.name as item_name, ei.emoji as item_emoji
       FROM economy_market_listings ml JOIN economy_items ei ON ml.item_id = ei.id
       WHERE ml.guild_id = ? AND ml.seller_id = ? AND ml.status = 'active'`,
      [guildId, userId],
    );
    if (rows.length === 0) { await v2Reply(interaction, 'You have no active listings.'); return; }
    const lines = rows.map((r: any) => `\`${r.id}\` ${r.item_emoji ?? ''} **${r.item_name}** x${r.quantity} — ${app.economy.formatCurrency(r.price_per_unit)}/ea`);
    await v2Reply(interaction, `**Your Listings**\n\n${lines.join('\n')}`);
  }
}

async function prefixExecute(message: Message, args: string[], app: App): Promise<void> {
  if (!app.economy.isEnabled(message.guildId!)) { await v2MessageReply(message, { content: 'Economy is not enabled.' }); return; }
  if (!app.config.economy.marketplace.enabled) { await v2MessageReply(message, { content: 'Marketplace is disabled.' }); return; }
  const sub = args[0]?.toLowerCase();
  const guildId = message.guildId!;
  const userId = message.author.id;

  if (sub === 'browse' || sub === 'ls') {
    const listings = await app.economy.marketplace.browse(guildId, { limit: 15 });
    if (listings.length === 0) { await v2MessageReply(message, { content: 'No active listings.' }); return; }
    const lines = listings.map((l: any) => `\`${l.id}\` **${l.item_name}** x${l.quantity} — ${app.economy.formatCurrency(l.price_per_unit)}/ea`);
    await v2MessageReply(message, { content: `**Marketplace**\n${lines.join('\n')}\n\nUse \`market buy <id>\` to purchase.` });
  } else if (sub === 'sell' && args[1] && args[2] && args[3]) {
    const result = await app.economy.marketplace.createListing(guildId, userId, args[1], parseInt(args[2]) || 1, parseInt(args[3]) || 1);
    if (!result.success) { await v2MessageReply(message, { content: result.error ?? 'Failed.' }); return; }
    await v2MessageReply(message, { content: `Listed ${args[2]}x ${args[1]} at ${app.economy.formatCurrency(parseInt(args[3]))}/ea.` });
  } else if (sub === 'buy' && args[1]) {
    const result = await app.economy.marketplace.purchaseListing(guildId, userId, parseInt(args[1]));
    if (!result.success) { await v2MessageReply(message, { content: result.error ?? 'Failed.' }); return; }
    await v2MessageReply(message, { content: `Purchased! Paid ${app.economy.formatCurrency(result.totalCost!)}.` });
  } else if (sub === 'cancel' && args[1]) {
    const result = await app.economy.marketplace.cancelListing(guildId, userId, parseInt(args[1]));
    await v2MessageReply(message, { content: result.success ? 'Listing cancelled.' : (result.error ?? 'Failed.') });
  } else {
    await v2MessageReply(message, { content: 'Usage: `market browse`, `market sell <item> <qty> <price>`, `market buy <id>`, `market cancel <id>`' });
  }
}

const command: BotCommand = {
  name: 'market',
  category: 'community',
  description: 'Marketplace — list, buy, sell items',
  data,
  aliases: ['marketplace'],
  execute,
  prefixExecute,
};

export default command;
