import { SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction, Message } from 'discord.js';
import type { App } from '../../core/context';
import type { BotCommand } from '../../types/command';
import { v2Reply } from '../../utils/v2';
import { v2MessageReply } from '../../utils/v2';
import type { RowDataPacket } from 'mysql2/promise';

const data = new SlashCommandBuilder()
  .setName('craft')
  .setDescription('Craft items from recipes')
  .addSubcommand((sub) => sub.setName('list').setDescription('List available recipes'))
  .addSubcommand((sub) => sub.setName('info').setDescription('View a recipe')
    .addStringOption((o) => o.setName('recipe').setDescription('Recipe slug').setRequired(true).setAutocomplete(true)))
  .addSubcommand((sub) => sub.setName('make').setDescription('Craft a recipe')
    .addStringOption((o) => o.setName('recipe').setDescription('Recipe slug').setRequired(true).setAutocomplete(true))
    .addIntegerOption((o) => o.setName('quantity').setDescription('How many to craft').setMinValue(1).setMaxValue(20).setRequired(false)));

async function execute(interaction: ChatInputCommandInteraction, app: App): Promise<void> {
  await interaction.deferReply();
  if (!app.economy.isEnabled(interaction.guildId!)) { await v2Reply(interaction, 'Economy is not enabled.'); return; }
  if (!app.config.economy.crafting.enabled) { await v2Reply(interaction, 'Crafting is disabled.'); return; }

  const sub = interaction.options.getSubcommand();
  const guildId = interaction.guildId!;
  const userId = interaction.user.id;

  if (sub === 'list') {
    const [recipes] = await app.db.query<RowDataPacket[]>(
      'SELECT * FROM economy_crafting_recipes WHERE guild_id = ? AND enabled = 1 ORDER BY required_level, name',
      [guildId],
    );
    if (recipes.length === 0) { await v2Reply(interaction, 'No recipes available.'); return; }
    const lines = recipes.map((r: any) => {
      const ingredients = JSON.parse(r.ingredients ?? '[]') as Array<{ item: string; qty: number }>;
      const ingStr = ingredients.map((i) => `${i.qty}x ${i.item}`).join(', ');
      return `${r.emoji ?? ''} **${r.name}** — ${ingStr} → ${r.result_quantity}x ${r.result_item_slug}${r.required_level > 0 ? ` (Lv.${r.required_level})` : ''}`;
    });
    await v2Reply(interaction, `**Crafting Recipes**\n\n${lines.join('\n')}`);
  } else if (sub === 'info') {
    const slug = interaction.options.getString('recipe', true);
    const [rows] = await app.db.query<RowDataPacket[]>(
      'SELECT * FROM economy_crafting_recipes WHERE guild_id = ? AND recipe_slug = ? AND enabled = 1',
      [guildId, slug],
    );
    if (rows.length === 0) { await v2Reply(interaction, `Recipe "${slug}" not found.`); return; }
    const r = rows[0] as any;
    const ingredients = JSON.parse(r.ingredients ?? '[]') as Array<{ item: string; qty: number }>;
    const lines = ingredients.map((i) => `- ${i.qty}x ${i.item}`);
    await v2Reply(interaction, `**${r.emoji ?? ''} ${r.name}**\n${r.description ?? ''}\n\n**Ingredients:**\n${lines.join('\n')}\n\n**Result:** ${r.result_quantity}x ${r.result_item_slug}\n**Level Required:** ${r.required_level}`);
  } else if (sub === 'make') {
    const slug = interaction.options.getString('recipe', true);
    const qty = interaction.options.getInteger('quantity') ?? 1;
    const [rows] = await app.db.query<RowDataPacket[]>(
      'SELECT * FROM economy_crafting_recipes WHERE guild_id = ? AND recipe_slug = ? AND enabled = 1',
      [guildId, slug],
    );
    if (rows.length === 0) { await v2Reply(interaction, `Recipe "${slug}" not found.`); return; }
    const recipe = rows[0] as any;
    const profile = await app.economy.getProfile(guildId, userId);
    if (recipe.required_level > profile.level) { await v2Reply(interaction, `Requires level ${recipe.required_level}.`); return; }

    const ingredients = JSON.parse(recipe.ingredients ?? '[]') as Array<{ item: string; qty: number }>;

    // Verify result item exists BEFORE consuming ingredients
    const [resultItem] = await app.db.query<RowDataPacket[]>(
      'SELECT id FROM economy_items WHERE guild_id = ? AND item_slug = ?',
      [guildId, recipe.result_item_slug],
    );
    if (resultItem.length === 0) {
      await v2Reply(interaction, 'Crafting result item not found in the database.');
      return;
    }

    // Check ingredients
    const [invRows] = await app.db.query<RowDataPacket[]>(
      `SELECT ei.item_slug, ei2.quantity FROM economy_inventories ei2 JOIN economy_items ei ON ei2.item_id = ei.id WHERE ei2.guild_id = ? AND ei2.user_id = ?`,
      [guildId, userId],
    );
    const invMap = new Map<string, number>();
    for (const r of invRows as any[]) invMap.set(r.item_slug, r.quantity);

    for (const ing of ingredients) {
      const have = invMap.get(ing.item) ?? 0;
      if (have < ing.qty * qty) {
        await v2Reply(interaction, `Not enough ${ing.item}. Need ${ing.qty * qty}, have ${have}.`);
        return;
      }
    }

    // Consume ingredients
    for (const ing of ingredients) {
      const [itemRow] = await app.db.query<RowDataPacket[]>(
        'SELECT id FROM economy_items WHERE guild_id = ? AND item_slug = ?',
        [guildId, ing.item],
      );
      if (itemRow.length > 0) {
        await app.economy.items.removeFromInventory(guildId, userId, itemRow[0].id, ing.qty * qty);
      }
    }

    // Add result
    await app.economy.items.addToInventory(guildId, userId, resultItem[0].id, recipe.result_quantity * qty, 'crafting');

    await v2Reply(interaction, `Crafted **${recipe.result_quantity * qty}x ${recipe.result_item_slug}**!`);
  }
}

async function prefixExecute(message: Message, args: string[], app: App): Promise<void> {
  if (!app.economy.isEnabled(message.guildId!)) { await v2MessageReply(message, { content: 'Economy is not enabled.' }); return; }
  const sub = args[0]?.toLowerCase() ?? 'list';
  if (sub === 'list' || sub === 'ls') {
    const [recipes] = await app.db.query<RowDataPacket[]>(
      'SELECT * FROM economy_crafting_recipes WHERE guild_id = ? AND enabled = 1',
      [message.guildId!],
    );
    if (recipes.length === 0) { await v2MessageReply(message, { content: 'No recipes available.' }); return; }
    const lines = recipes.map((r: any) => `${r.emoji ?? ''} **${r.name}** (${r.recipe_slug})`);
    await v2MessageReply(message, { content: `**Recipes**\n${lines.join('\n')}` });
  } else if (sub === 'make' && args[1]) {
    // Simplified prefix craft — delegates to same logic
    await v2MessageReply(message, { content: `Use \`/craft make recipe:${args[1]}\` or \`craft ${args[1]}\` (full crafting requires slash command for ingredient selection).` });
  } else {
    await v2MessageReply(message, { content: 'Usage: `craft list`, `craft make <recipe>`' });
  }
}

const command: BotCommand = {
  name: 'craft',
  category: 'community',
  description: 'Craft items from recipes',
  data,
  aliases: ['crafting'],
  execute,
  prefixExecute,
};

export default command;
