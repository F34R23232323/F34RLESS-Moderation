import { SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction, Message } from 'discord.js';
import type { App } from '../../core/context';
import type { BotCommand } from '../../types/command';
import { v2Reply } from '../../utils/v2';

const data = new SlashCommandBuilder()
  .setName('botinfo')
  .setDescription('Bot info: version, memory, shards');

async function execute(interaction: ChatInputCommandInteraction, app: App): Promise<void> {
  await interaction.deferReply();
  const pkg = require('../../../../package.json') as { version: string };
  const mem = process.memoryUsage();
  const lines = [
    `f34rless-moderation v${pkg.version}`,
    `Node ${process.version}`,
    `Memory: ${Math.round(mem.rss / 1024 / 1024)}MB RSS / ${Math.round(mem.heapUsed / 1024 / 1024)}MB heap`,
    `Shards: ${app.client.shard?.count ?? 1}`,
    `Guilds: ${app.client.guilds.cache.size}`,
    `Commands loaded: ${app.commands.size}`,
    `Started: <t:${Math.floor(app.startedAt / 1000)}:R>`,
  ];
  await v2Reply(interaction, lines.join('\n'));
}

async function prefixExecute(message: Message, _args: string[], app: App): Promise<void> {
  await message.reply({ content: `f34rless-moderation — ${app.commands.size} commands, ${app.client.guilds.cache.size} guilds.` });
}

const command: BotCommand = {
  name: 'botinfo',
  category: 'utility',
  description: 'Bot info: version, memory, shards',
  data,
  permissions: [],
  aliases: ['bi'],
  execute,
  prefixExecute,
};

export default command;