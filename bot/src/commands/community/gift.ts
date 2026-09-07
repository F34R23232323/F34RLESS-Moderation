import { SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction, Message } from 'discord.js';
import type { App } from '../../core/context';
import type { BotCommand } from '../../types/command';
import { v2Reply } from '../../utils/v2';
import { v2MessageReply } from '../../utils/v2';
import type { RowDataPacket } from 'mysql2/promise';

const data = new SlashCommandBuilder()
  .setName('gift')
  .setDescription('Gift an item or coins to another user')
  .addUserOption((o) => o.setName('user').setDescription('Recipient').setRequired(true))
  .addStringOption((o) => o.setName('item').setDescription('Item slug to gift').setRequired(false))
  .addIntegerOption((o) => o.setName('amount').setDescription('Coin amount to gift').setRequired(false))
  .addIntegerOption((o) => o.setName('quantity').setDescription('Item quantity').setMinValue(1).setRequired(false))
  .addStringOption((o) => o.setName('note').setDescription('Optional note').setRequired(false));

async function execute(interaction: ChatInputCommandInteraction, app: App): Promise<void> {
  await interaction.deferReply();
  if (!app.economy.isEnabled(interaction.guildId!)) { await v2Reply(interaction, 'Economy is not enabled.'); return; }

  const target = interaction.options.getUser('user', true);
  const guildId = interaction.guildId!;
  const userId = interaction.user.id;
  if (target.id === userId) { await v2Reply(interaction, 'Cannot gift to yourself.'); return; }
  if (target.bot) { await v2Reply(interaction, 'Cannot gift to bots.'); return; }

  const itemSlug = interaction.options.getString('item');
  const amount = interaction.options.getInteger('amount');
  const qty = interaction.options.getInteger('quantity') ?? 1;
  const note = interaction.options.getString('note');

  if (amount && amount > 0) {
    const { success } = await app.economy.ledger.debit(guildId, userId, userId, amount, 'gift_sent', { reason: `Gift to ${target.username}` });
    if (!success) { await v2Reply(interaction, 'Insufficient funds.'); return; }
    await app.economy.ledger.credit(guildId, userId, target.id, amount, 'gift_received', { reason: `Gift from ${interaction.user.username}`, metadata: { note } });
    await v2Reply(interaction, `Gifted **${app.economy.formatCurrency(amount)}** to ${target}${note ? ` — "${note}"` : ''}`);
  } else if (itemSlug) {
    const [itemRows] = await app.db.query<RowDataPacket[]>(
      'SELECT * FROM economy_items WHERE guild_id = ? AND item_slug = ?',
      [guildId, itemSlug],
    );
    if (itemRows.length === 0) { await v2Reply(interaction, `Item "${itemSlug}" not found.`); return; }
    const item = itemRows[0] as any;
    if (!item.giftable) { await v2Reply(interaction, 'This item cannot be gifted.'); return; }
    const [invRows] = await app.db.query<RowDataPacket[]>(
      'SELECT * FROM economy_inventories WHERE guild_id = ? AND user_id = ? AND item_id = ?',
      [guildId, userId, item.id],
    );
    const inv = invRows[0] as any;
    if (!inv || inv.quantity < qty) { await v2Reply(interaction, 'Insufficient items.'); return; }
    await app.economy.items.removeFromInventory(guildId, userId, item.id, qty);
    await app.economy.items.addToInventory(guildId, target.id, item.id, qty, 'gift');
    await v2Reply(interaction, `Gifted **${qty}x ${item.name}** to ${target}${note ? ` — "${note}"` : ''}`);
  } else {
    await v2Reply(interaction, 'Specify an item or amount to gift.');
  }
}

async function prefixExecute(message: Message, args: string[], app: App): Promise<void> {
  if (!app.economy.isEnabled(message.guildId!)) { await v2MessageReply(message, { content: 'Economy is not enabled.' }); return; }
  const targetId = args[0]?.replace(/[<@!>]/g, '');
  if (!targetId) { await v2MessageReply(message, { content: 'Usage: `gift <user> <amount|item> [quantity]`' }); return; }
  const target = await app.client.users.fetch(targetId).catch(() => null);
  if (!target) { await v2MessageReply(message, { content: 'User not found.' }); return; }
  if (target.id === message.author.id) { await v2MessageReply(message, { content: 'Cannot gift to yourself.' }); return; }

  const guildId = message.guildId!;
  const amount = parseInt(args[1] ?? '0');
  if (amount > 0) {
    const { success } = await app.economy.ledger.debit(guildId, message.author.id, message.author.id, amount, 'gift_sent', { reason: `Gift to ${target.username}` });
    if (!success) { await v2MessageReply(message, { content: 'Insufficient funds.' }); return; }
    await app.economy.ledger.credit(guildId, message.author.id, target.id, amount, 'gift_received', { reason: `Gift from ${message.author.username}` });
    await v2MessageReply(message, { content: `Gifted **${app.economy.formatCurrency(amount)}** to ${target}.` });
  } else {
    await v2MessageReply(message, { content: 'Usage: `gift <user> <amount>`' });
  }
}

const command: BotCommand = {
  name: 'gift',
  category: 'community',
  description: 'Gift items or coins to another user',
  data,
  aliases: ['give'],
  execute,
  prefixExecute,
};

export default command;
