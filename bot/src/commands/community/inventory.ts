import { SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction, Message } from 'discord.js';
import type { App } from '../../core/context';
import type { BotCommand } from '../../types/command';
import { v2Reply } from '../../utils/v2';
import { v2MessageReply } from '../../utils/v2';

const data = new SlashCommandBuilder()
  .setName('inventory')
  .setDescription('View your inventory')
  .addUserOption((o) => o.setName('user').setDescription('View another user\'s inventory').setRequired(false));

async function execute(interaction: ChatInputCommandInteraction, app: App): Promise<void> {
  await interaction.deferReply();
  if (!app.economy.isEnabled(interaction.guildId!)) { await v2Reply(interaction, 'Economy is not enabled.'); return; }
  const target = interaction.options.getUser('user') ?? interaction.user;
  const inv = await app.economy.items.getInventory(interaction.guildId!, target.id);
  if (inv.length === 0) { await v2Reply(interaction, `${target.username}'s inventory is empty.`); return; }
  const lines = inv.map((e) => `${e.emoji ?? ''} **${e.name}** x${e.quantity}${e.equipped ? ' (equipped)' : ''}`);
  await v2Reply(interaction, `**${target.username}'s Inventory** (${inv.length} items)\n\n${lines.join('\n')}`);
}

async function prefixExecute(message: Message, args: string[], app: App): Promise<void> {
  if (!app.economy.isEnabled(message.guildId!)) { await v2MessageReply(message, { content: 'Economy is not enabled.' }); return; }
  const targetId = args[0]?.replace(/[<@!>]/g, '') || message.author.id;
  const target = await app.client.users.fetch(targetId).catch(() => null);
  if (!target) { await v2MessageReply(message, { content: 'User not found.' }); return; }
  const inv = await app.economy.items.getInventory(message.guildId!, target.id);
  if (inv.length === 0) { await v2MessageReply(message, { content: `${target.username}'s inventory is empty.` }); return; }
  const lines = inv.map((e) => `${e.emoji ?? ''} **${e.name}** x${e.quantity}`);
  await v2MessageReply(message, { content: `**${target.username}'s Inventory** (${inv.length} items)\n${lines.join('\n')}` });
}

const command: BotCommand = {
  name: 'inventory',
  category: 'community',
  description: 'View your inventory',
  data,
  aliases: ['inv', 'items'],
  execute,
  prefixExecute,
};

export default command;
