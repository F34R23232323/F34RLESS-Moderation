import { SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction, Message } from 'discord.js';
import type { App } from '../../core/context';
import type { BotCommand } from '../../types/command';
import { v2Reply } from '../../utils/v2';
import { v2MessageReply } from '../../utils/v2';
import type { RowDataPacket } from 'mysql2/promise';

const data = new SlashCommandBuilder()
  .setName('collectables')
  .setDescription('View collectable sets and your progress')
  .addStringOption((o) => o.setName('collection').setDescription('Specific collection to view').setRequired(false).setAutocomplete(true));

async function execute(interaction: ChatInputCommandInteraction, app: App): Promise<void> {
  await interaction.deferReply();
  if (!app.economy.isEnabled(interaction.guildId!)) { await v2Reply(interaction, 'Economy is not enabled.'); return; }

  const slug = interaction.options.getString('collection');
  const guildId = interaction.guildId!;
  const userId = interaction.user.id;

  if (slug) {
    const [collRows] = await app.db.query<RowDataPacket[]>(
      'SELECT * FROM economy_collections WHERE guild_id = ? AND collection_slug = ? AND enabled = 1',
      [guildId, slug],
    );
    if (collRows.length === 0) { await v2Reply(interaction, `Collection "${slug}" not found.`); return; }
    const coll = collRows[0] as any;
    const required = JSON.parse(coll.required_items ?? '[]') as string[];

    // Check how many the user owns
    const [invRows] = await app.db.query<RowDataPacket[]>(
      'SELECT ei.item_slug FROM economy_inventories ei2 JOIN economy_items ei ON ei2.item_id = ei.id WHERE ei2.guild_id = ? AND ei2.user_id = ? AND ei.item_slug IN (?)',
      [guildId, userId, required],
    );
    const owned = new Set(invRows.map((r: any) => r.item_slug));
    const ownedCount = [...required].filter((s) => owned.has(s)).length;
    const completed = ownedCount >= required.length;

    const lines = required.map((s) => `${owned.has(s) ? '✅' : '⬜'} ${s}`);
    await v2Reply(interaction, `**${coll.emoji ?? ''} ${coll.name}**\n${coll.description ?? ''}\n\n${lines.join('\n')}\n\n**Progress:** ${ownedCount}/${required.length}${completed ? ' — COMPLETE!' : ''}\nReward: ${app.economy.formatCurrency(coll.reward_currency)}${coll.reward_title ? ` + Title: ${coll.reward_title}` : ''}`);
  } else {
    const [colls] = await app.db.query<RowDataPacket[]>(
      'SELECT * FROM economy_collections WHERE guild_id = ? AND enabled = 1 ORDER BY name',
      [guildId],
    );
    if (colls.length === 0) { await v2Reply(interaction, 'No collections available.'); return; }
    const lines = colls.map((c: any) => {
      const items = JSON.parse(c.required_items ?? '[]') as string[];
      return `${c.emoji ?? ''} **${c.name}** — ${items.length} items — Reward: ${app.economy.formatCurrency(c.reward_currency)}`;
    });
    await v2Reply(interaction, `**Collections**\n\n${lines.join('\n')}\n\nUse \`/collectables collection:<name>\` to view details.`);
  }
}

async function prefixExecute(message: Message, args: string[], app: App): Promise<void> {
  if (!app.economy.isEnabled(message.guildId!)) { await v2MessageReply(message, { content: 'Economy is not enabled.' }); return; }
  const guildId = message.guildId!;
  if (args[0]) {
    const [collRows] = await app.db.query<RowDataPacket[]>(
      'SELECT * FROM economy_collections WHERE guild_id = ? AND collection_slug = ? AND enabled = 1',
      [guildId, args[0]],
    );
    if (collRows.length === 0) { await v2MessageReply(message, { content: `Collection "${args[0]}" not found.` }); return; }
    const coll = collRows[0] as any;
    const required = JSON.parse(coll.required_items ?? '[]') as string[];
    const [invRows] = await app.db.query<RowDataPacket[]>(
      'SELECT ei.item_slug FROM economy_inventories ei2 JOIN economy_items ei ON ei2.item_id = ei.id WHERE ei2.guild_id = ? AND ei2.user_id = ? AND ei.item_slug IN (?)',
      [guildId, message.author.id, required],
    );
    const owned = new Set(invRows.map((r: any) => r.item_slug));
    const ownedCount = [...required].filter((s) => owned.has(s)).length;
    const lines = required.map((s) => `${owned.has(s) ? '✅' : '⬜'} ${s}`);
    await v2MessageReply(message, { content: `**${coll.name}**\n${lines.join('\n')}\nProgress: ${ownedCount}/${required.length}` });
  } else {
    const [colls] = await app.db.query<RowDataPacket[]>(
      'SELECT * FROM economy_collections WHERE guild_id = ? AND enabled = 1 ORDER BY name',
      [guildId],
    );
    if (colls.length === 0) { await v2MessageReply(message, { content: 'No collections available.' }); return; }
    const lines = colls.map((c: any) => `${c.emoji ?? ''} **${c.name}**`);
    await v2MessageReply(message, { content: `**Collections**\n${lines.join('\n')}` });
  }
}

const command: BotCommand = {
  name: 'collectables',
  category: 'community',
  description: 'View collectable sets',
  data,
  aliases: ['collections', 'colls'],
  execute,
  prefixExecute,
};

export default command;
