import { SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction, Message } from 'discord.js';
import type { App } from '../../core/context';
import type { BotCommand } from '../../types/command';
import { v2Reply } from '../../utils/v2';
import { v2MessageReply } from '../../utils/v2';
import type { RowDataPacket } from 'mysql2/promise';

const data = new SlashCommandBuilder()
  .setName('trade')
  .setDescription('Trade with another user')
  .addSubcommand((sub) => sub.setName('create').setDescription('Start a trade')
    .addUserOption((o) => o.setName('user').setDescription('User to trade with').setRequired(true)))
  .addSubcommand((sub) => sub.setName('view').setDescription('View active trade'))
  .addSubcommand((sub) => sub.setName('confirm').setDescription('Confirm your trade offer'))
  .addSubcommand((sub) => sub.setName('cancel').setDescription('Cancel the trade'))
  .addSubcommand((sub) => sub.setName('add').setDescription('Add currency or item to trade')
    .addIntegerOption((o) => o.setName('amount').setDescription('Currency amount to add').setRequired(false))
    .addStringOption((o) => o.setName('item').setDescription('Item slug to add').setRequired(false))
    .addIntegerOption((o) => o.setName('quantity').setDescription('Item quantity').setMinValue(1).setRequired(false)));

async function execute(interaction: ChatInputCommandInteraction, app: App): Promise<void> {
  await interaction.deferReply();
  if (!app.economy.isEnabled(interaction.guildId!)) { await v2Reply(interaction, 'Economy is not enabled.'); return; }

  const sub = interaction.options.getSubcommand();
  const guildId = interaction.guildId!;
  const userId = interaction.user.id;

  if (sub === 'create') {
    const target = interaction.options.getUser('user', true);
    if (target.id === userId) { await v2Reply(interaction, 'Cannot trade with yourself.'); return; }
    const result = await app.economy.trading.createTrade(guildId, userId, target.id);
    if (typeof result === 'string') { await v2Reply(interaction, result); return; }
    await v2Reply(interaction, `**Trade created with ${target}**\nTrade ID: \`${result.id}\`\n\nUse \`/trade add\` to add items or currency, then \`/trade confirm\` when ready.`);
  } else if (sub === 'view') {
    const [trades] = await app.db.query<RowDataPacket[]>(
      "SELECT * FROM economy_trades WHERE guild_id = ? AND (initiator_id = ? OR recipient_id = ?) AND status IN ('draft', 'reviewing') ORDER BY id DESC LIMIT 1",
      [guildId, userId, userId],
    );
    if (trades.length === 0) { await v2Reply(interaction, 'No active trade.'); return; }
    const t = trades[0] as any;
    const confirmed = JSON.parse(t.confirmed_by ?? '[]');
    await v2Reply(interaction, [
      `**Trade #${t.id}** (${t.status})`,
      `**You offer:** ${app.economy.formatCurrency(t.initiator_currency)}${t.initiator_items ? ` + ${t.initiator_items}` : ''}`,
      `**They offer:** ${app.economy.formatCurrency(t.recipient_currency)}${t.recipient_items ? ` + ${t.recipient_items}` : ''}`,
      `**Confirmed:** ${confirmed.length}/2`,
      `Expires: <t:${Math.floor(new Date(t.expires_at).getTime() / 1000)}:R>`,
    ].join('\n'));
  } else if (sub === 'confirm') {
    const [trades] = await app.db.query<RowDataPacket[]>(
      "SELECT id FROM economy_trades WHERE guild_id = ? AND (initiator_id = ? OR recipient_id = ?) AND status IN ('draft', 'reviewing') ORDER BY id DESC LIMIT 1",
      [guildId, userId, userId],
    );
    if (trades.length === 0) { await v2Reply(interaction, 'No active trade to confirm.'); return; }
    const result = await app.economy.trading.confirmTrade(guildId, trades[0].id, userId);
    if (!result.success) { await v2Reply(interaction, result.error ?? 'Confirmation failed.'); return; }
    await v2Reply(interaction, result.completed ? '**Trade completed!**' : 'Trade confirmed. Waiting for the other party.');
  } else if (sub === 'cancel') {
    const [trades] = await app.db.query<RowDataPacket[]>(
      "SELECT id FROM economy_trades WHERE guild_id = ? AND (initiator_id = ? OR recipient_id = ?) AND status IN ('draft', 'reviewing') ORDER BY id DESC LIMIT 1",
      [guildId, userId, userId],
    );
    if (trades.length === 0) { await v2Reply(interaction, 'No active trade to cancel.'); return; }
    const result = await app.economy.trading.cancelTrade(guildId, trades[0].id, userId);
    await v2Reply(interaction, result.success ? 'Trade cancelled.' : (result.error ?? 'Failed to cancel.'));
  } else if (sub === 'add') {
    const [trades] = await app.db.query<RowDataPacket[]>(
      "SELECT * FROM economy_trades WHERE guild_id = ? AND (initiator_id = ? OR recipient_id = ?) AND status = 'draft' ORDER BY id DESC LIMIT 1",
      [guildId, userId, userId],
    );
    if (trades.length === 0) { await v2Reply(interaction, 'No active draft trade.'); return; }
    const trade = trades[0] as any;
    const side = trade.initiator_id === userId ? 'initiator' : 'recipient';
    const amount = interaction.options.getInteger('amount');
    const itemSlug = interaction.options.getString('item');
    const qty = interaction.options.getInteger('quantity') ?? 1;

    if (amount) {
      const result = await app.economy.trading.addToTrade(guildId, trade.id, userId, side, { currency: amount });
      if (!result.success) { await v2Reply(interaction, result.error ?? 'Failed.'); return; }
      await v2Reply(interaction, `Added ${app.economy.formatCurrency(amount)} to your offer.`);
    } else if (itemSlug) {
      const [itemRows] = await app.db.query<RowDataPacket[]>(
        'SELECT id FROM economy_items WHERE guild_id = ? AND item_slug = ?',
        [guildId, itemSlug],
      );
      if (itemRows.length === 0) { await v2Reply(interaction, `Item "${itemSlug}" not found.`); return; }
      const result = await app.economy.trading.addToTrade(guildId, trade.id, userId, side, { itemId: itemRows[0].id, quantity: qty });
      if (!result.success) { await v2Reply(interaction, result.error ?? 'Failed.'); return; }
      await v2Reply(interaction, `Added ${qty}x ${itemSlug} to your offer.`);
    } else {
      await v2Reply(interaction, 'Specify an amount or item to add.');
    }
  }
}

async function prefixExecute(message: Message, args: string[], app: App): Promise<void> {
  if (!app.economy.isEnabled(message.guildId!)) { await v2MessageReply(message, { content: 'Economy is not enabled.' }); return; }
  const sub = args[0]?.toLowerCase();
  const guildId = message.guildId!;
  const userId = message.author.id;

  if (sub === 'create' && args[1]) {
    const targetId = args[1].replace(/[<@!>]/g, '');
    const result = await app.economy.trading.createTrade(guildId, userId, targetId);
    if (typeof result === 'string') { await v2MessageReply(message, { content: result }); return; }
    await v2MessageReply(message, { content: `Trade #${result.id} created. Use \`trade add\`, \`trade confirm\`, \`trade cancel\`.` });
  } else if (sub === 'confirm') {
    const [trades] = await app.db.query<RowDataPacket[]>(
      "SELECT id FROM economy_trades WHERE guild_id = ? AND (initiator_id = ? OR recipient_id = ?) AND status IN ('draft', 'reviewing') ORDER BY id DESC LIMIT 1",
      [guildId, userId, userId],
    );
    if (trades.length === 0) { await v2MessageReply(message, { content: 'No active trade.' }); return; }
    const result = await app.economy.trading.confirmTrade(guildId, trades[0].id, userId);
    await v2MessageReply(message, { content: result.success ? (result.completed ? 'Trade completed!' : 'Confirmed, waiting for other party.') : (result.error ?? 'Failed.') });
  } else if (sub === 'cancel') {
    const [trades] = await app.db.query<RowDataPacket[]>(
      "SELECT id FROM economy_trades WHERE guild_id = ? AND (initiator_id = ? OR recipient_id = ?) AND status IN ('draft', 'reviewing') ORDER BY id DESC LIMIT 1",
      [guildId, userId, userId],
    );
    if (trades.length === 0) { await v2MessageReply(message, { content: 'No active trade.' }); return; }
    await app.economy.trading.cancelTrade(guildId, trades[0].id, userId);
    await v2MessageReply(message, { content: 'Trade cancelled.' });
  } else {
    await v2MessageReply(message, { content: 'Usage: `trade create <user>`, `trade confirm`, `trade cancel`' });
  }
}

const command: BotCommand = {
  name: 'trade',
  category: 'community',
  description: 'Trade with another user',
  data,
  execute,
  prefixExecute,
};

export default command;
