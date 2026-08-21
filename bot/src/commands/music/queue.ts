import { SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction, Message } from 'discord.js';
import type { App } from '../../core/context';
import type { BotCommand } from '../../types/command';
import { v2Reply, v2MessageReply } from '../../utils/v2';
import { getQueue, queueListText } from '../../music/helpers';

const data = new SlashCommandBuilder()
  .setName('queue')
  .setDescription('Show the current queue')
  .addIntegerOption((o) => o.setName('page').setDescription('Page number').setMinValue(1).setRequired(false));

async function run(app: App, guildId: string, page: number): Promise<string> {
  const queue = getQueue(app, guildId);
  if (!queue) return 'Nothing is playing right now.';
  return queueListText(queue, page);
}

async function execute(interaction: ChatInputCommandInteraction, app: App): Promise<void> {
  const guild = interaction.guild;
  if (!guild) return;
  const page = interaction.options.getInteger('page') ?? 1;
  await v2Reply(interaction, await run(app, guild.id, page), { ephemeral: true });
}

async function prefixExecute(message: Message, args: string[], app: App): Promise<void> {
  const guild = message.guild;
  if (!guild) return;
  const page = Math.max(1, parseInt(args[0] ?? '1', 10) || 1);
  await v2MessageReply(message, { content: await run(app, guild.id, page) });
}

const command: BotCommand = {
  name: 'queue',
  category: 'music',
  description: 'Show the current queue',
  data,
  permissions: [],
  aliases: ['q'],
  execute,
  prefixExecute,
};

export default command;