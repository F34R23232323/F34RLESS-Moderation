import { SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction, Message } from 'discord.js';
import type { App } from '../../core/context';
import type { BotCommand } from '../../types/command';
import { v2Reply, v2MessageReply } from '../../utils/v2';
import { getQueue, isUserInBotChannel } from '../../music/helpers';

const data = new SlashCommandBuilder().setName('shuffle').setDescription('Shuffle the queue');

async function run(app: App, guildId: string, member: any): Promise<string | null> {
  const queue = getQueue(app, guildId);
  if (!queue) return 'Nothing is playing right now.';
  if (!isUserInBotChannel(app, guildId, member)) return 'You must be in the same voice channel as the bot.';
  if (queue.songs.length < 2) return 'Not enough songs in the queue to shuffle.';
  await queue.shuffle();
  await app.music.refreshPanel(guildId, queue);
  return `🔀 Shuffled **${queue.songs.length}** songs.`;
}

async function execute(interaction: ChatInputCommandInteraction, app: App): Promise<void> {
  const guild = interaction.guild;
  if (!guild) return;
  const error = await run(app, guild.id, interaction.member);
  await v2Reply(interaction, error ?? '🔀 Shuffled.', { ephemeral: !!error });
}

async function prefixExecute(message: Message, _args: string[], app: App): Promise<void> {
  const guild = message.guild;
  if (!guild) return;
  const error = await run(app, guild.id, message.member);
  await v2MessageReply(message, { content: error ?? '🔀 Shuffled.' });
}

const command: BotCommand = {
  name: 'shuffle',
  category: 'music',
  description: 'Shuffle the queue',
  data,
  permissions: [],
  aliases: ['mix'],
  execute,
  prefixExecute,
};

export default command;