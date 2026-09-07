import { SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction, Message } from 'discord.js';
import type { App } from '../../core/context';
import type { BotCommand } from '../../types/command';
import { v2Reply, buildRichV2 } from '../../utils/v2';
import { v2MessageReply } from '../../utils/v2';
import { ButtonStyle } from 'discord.js';

const data = new SlashCommandBuilder()
  .setName('shop')
  .setDescription('Browse economy shops')
  .addStringOption((o) => o.setName('shop').setDescription('Shop to browse').setRequired(false).setAutocomplete(true));

async function execute(interaction: ChatInputCommandInteraction, app: App): Promise<void> {
  await interaction.deferReply();
  if (!app.economy.isEnabled(interaction.guildId!)) { await v2Reply(interaction, 'Economy is not enabled.'); return; }

  const shopSlug = interaction.options.getString('shop');
  if (shopSlug) {
    const shop = await app.economy.items.getShop(interaction.guildId!, shopSlug);
    if (!shop) { await v2Reply(interaction, `Shop "${shopSlug}" not found.`); return; }
    const listings = await app.economy.items.getShopItems(shop.id);
    if (listings.length === 0) { await v2Reply(interaction, `${shop.emoji ?? ''} **${shop.name}** is empty.`); return; }
    const lines = listings.map((l) => `${l.emoji ?? ''} **${l.name}** — ${app.economy.formatCurrency(l.override_price ?? l.buy_price)}${l.stock !== null ? ` (${l.stock} in stock)` : ''}`);
    await v2Reply(interaction, `**${shop.emoji ?? ''} ${shop.name}**\n${shop.description ?? ''}\n\n${lines.join('\n')}`);
  } else {
    const shops = await app.economy.items.getShops(interaction.guildId!);
    if (shops.length === 0) { await v2Reply(interaction, 'No shops available.'); return; }
    const lines = shops.map((s) => `${s.emoji ?? ''} **${s.name}** — ${s.description ?? 'No description'}`);
    await v2Reply(interaction, `**Available Shops**\n\n${lines.join('\n')}\n\nUse \`/shop shop:<name>\` to browse.`);
  }
}

async function prefixExecute(message: Message, args: string[], app: App): Promise<void> {
  if (!app.economy.isEnabled(message.guildId!)) { await v2MessageReply(message, { content: 'Economy is not enabled.' }); return; }
  if (args[0]) {
    const shop = await app.economy.items.getShop(message.guildId!, args[0]);
    if (!shop) { await v2MessageReply(message, { content: `Shop "${args[0]}" not found.` }); return; }
    const listings = await app.economy.items.getShopItems(shop.id);
    if (listings.length === 0) { await v2MessageReply(message, { content: `${shop.emoji ?? ''} **${shop.name}** is empty.` }); return; }
    const lines = listings.map((l) => `${l.emoji ?? ''} **${l.name}** — ${app.economy.formatCurrency(l.override_price ?? l.buy_price)}${l.stock !== null ? ` (${l.stock} in stock)` : ''}`);
    await v2MessageReply(message, { content: `**${shop.emoji ?? ''} ${shop.name}**\n${lines.join('\n')}` });
  } else {
    const shops = await app.economy.items.getShops(message.guildId!);
    if (shops.length === 0) { await v2MessageReply(message, { content: 'No shops available.' }); return; }
    const lines = shops.map((s) => `${s.emoji ?? ''} **${s.name}** — ${s.description ?? ''}`);
    await v2MessageReply(message, { content: `**Available Shops**\n${lines.join('\n')}` });
  }
}

const command: BotCommand = {
  name: 'shop',
  category: 'community',
  description: 'Browse economy shops',
  data,
  aliases: ['stores', 'store'],
  execute,
  prefixExecute,
};

export default command;
