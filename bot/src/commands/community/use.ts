import { SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction, Message } from 'discord.js';
import type { App } from '../../core/context';
import type { BotCommand } from '../../types/command';
import { v2Reply } from '../../utils/v2';
import { v2MessageReply } from '../../utils/v2';
import type { RowDataPacket } from 'mysql2/promise';

const data = new SlashCommandBuilder()
  .setName('use')
  .setDescription('Use an item from your inventory')
  .addStringOption((o) => o.setName('item').setDescription('Item to use').setRequired(true).setAutocomplete(true))
  .addIntegerOption((o) => o.setName('quantity').setDescription('Quantity to use').setMinValue(1).setRequired(false));

async function execute(interaction: ChatInputCommandInteraction, app: App): Promise<void> {
  await interaction.deferReply();
  if (!app.economy.isEnabled(interaction.guildId!)) { await v2Reply(interaction, 'Economy is not enabled.'); return; }
  const itemSlug = interaction.options.getString('item', true);
  const qty = interaction.options.getInteger('quantity') ?? 1;
  const guildId = interaction.guildId!;
  const userId = interaction.user.id;

  const [itemRows] = await app.db.query<RowDataPacket[]>(
    'SELECT * FROM economy_items WHERE guild_id = ? AND item_slug = ?',
    [guildId, itemSlug],
  );
  if (itemRows.length === 0) { await v2Reply(interaction, `Item "${itemSlug}" not found.`); return; }
  const item = itemRows[0] as any;

  // Check inventory
  const [invRows] = await app.db.query<RowDataPacket[]>(
    'SELECT * FROM economy_inventories WHERE guild_id = ? AND user_id = ? AND item_id = ?',
    [guildId, userId, item.id],
  );
  if (!invRows.length || (invRows[0] as any).quantity < qty) {
    await v2Reply(interaction, `You don't have ${qty}x ${item.name}.`);
    return;
  }

  // Apply effect based on effect_type
  if (item.effect_type) {
    const meta = typeof item.effect_metadata === 'string' ? JSON.parse(item.effect_metadata) : item.effect_metadata ?? {};
    let description = '';

    switch (item.effect_type) {
      case 'fixed_reward': {
        const reward = meta.amount ?? 100;
        await app.economy.ledger.credit(guildId, userId, userId, reward, 'item_reward', { reason: `Used ${item.name}`, refType: 'item', refId: String(item.id) });
        description = `You earned **${app.economy.formatCurrency(reward)}**!`;
        break;
      }
      case 'earning_multiplier': {
        const multiplier = meta.multiplier ?? 2;
        const durationMinutes = meta.duration_minutes ?? 60;
        const expiresAt = new Date(Date.now() + durationMinutes * 60 * 1000);
        await app.economy.items.applyEffect(guildId, userId, item.id, 'earning_multiplier', { multiplier }, expiresAt);
        description = `**${multiplier}x earning multiplier** active for ${durationMinutes} minutes.`;
        break;
      }
      case 'xp_boost': {
        const xpAmount = meta.xp ?? 50;
        await app.db.execute('UPDATE economy_profiles SET xp = xp + ? WHERE guild_id = ? AND user_id = ?', [xpAmount, guildId, userId]);
        description = `You gained **${xpAmount} XP**!`;
        break;
      }
      case 'cosmetic_badge': {
        const badge = meta.badge ?? item.name;
        await app.economy.items.applyEffect(guildId, userId, item.id, 'cosmetic_badge', { badge });
        description = `**${badge}** badge added to your profile.`;
        break;
      }
      default:
        description = `You used **${item.name}**. (No effect defined)`;
    }

    // Consume if consumable
    if (item.item_type === 'consumable') {
      await app.economy.items.removeFromInventory(guildId, userId, item.id, qty);
    }

    await v2Reply(interaction, `${item.emoji ?? ''} ${description}`);
  } else {
    await v2Reply(interaction, `${item.emoji ?? ''} **${item.name}** — This item has no use effect.`);
  }
}

async function prefixExecute(message: Message, args: string[], app: App): Promise<void> {
  if (!app.economy.isEnabled(message.guildId!)) { await v2MessageReply(message, { content: 'Economy is not enabled.' }); return; }
  if (!args[0]) { await v2MessageReply(message, { content: 'Usage: `use <item> [quantity]`' }); return; }
  // Simplified prefix version — use the slash command for full effect handling
  await v2MessageReply(message, { content: `Use \`/use item:${args[0]}\` for full item usage.` });
}

const command: BotCommand = {
  name: 'use',
  category: 'community',
  description: 'Use an item from inventory',
  data,
  execute,
  prefixExecute,
};

export default command;
