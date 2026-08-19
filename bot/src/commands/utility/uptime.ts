import { SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction, Message } from 'discord.js';
import type { App } from '../../core/context';
import type { BotCommand } from '../../types/command';
import { v2Reply } from '../../utils/v2';
import { v2MessageReply } from '../../utils/v2';

function formatUptime(ms: number): string {
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${d}d ${h}h ${m}m ${sec}s`;
}

const data = new SlashCommandBuilder()
  .setName('uptime')
  .setDescription('Bot uptime');

async function execute(interaction: ChatInputCommandInteraction, app: App): Promise<void> {
  await interaction.deferReply();
  await v2Reply(interaction, `Uptime: ${formatUptime(Date.now() - app.startedAt)}`);
}

async function prefixExecute(message: Message, _args: string[], app: App): Promise<void> {
  await v2MessageReply(message, { content: `Uptime: ${formatUptime(Date.now() - app.startedAt)}` });
}

const command: BotCommand = {
  name: 'uptime',
  category: 'utility',
  description: 'Bot uptime',
  data,
  permissions: [],
  aliases: [],
  execute,
  prefixExecute,
};

export default command;