import { SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction, Message } from 'discord.js';
import type { App } from '../../core/context';
import type { BotCommand } from '../../types/command';
import { v2Reply, v2MessageReply } from '../../utils/v2';
import { getQueue, isUserInBotChannel } from '../../music/helpers';

const data = new SlashCommandBuilder().setName('stop').setDescription('Stop playback and clear the queue');

async function run(app: App, guildId: string, member: any): Promise<string | null> {
  const queue = getQueue(app, guildId);
  if (!queue) return 'Nothing is playing right now.';
  if (!isUserInBotChannel(app, guildId, member)) return 'You must be in the same voice channel as the bot.';
  await app.music.stop(guildId);
  return null;
}

async function execute(interaction: ChatInputCommandInteraction, app: App): Promise<void> {
  const guild = interaction.guild;
  if (!guild) return;
  const error = await run(app, guild.id, interaction.member);
  await v2Reply(interaction, error ?? '⏹ Stopped and cleared the queue.', { ephemeral: !!error });
}

async function prefixExecute(message: Message, _args: string[], app: App): Promise<void> {
  const guild = message.guild;
  if (!guild) return;
  const error = await run(app, guild.id, message.member);
  await v2MessageReply(message, { content: error ?? '⏹ Stopped and cleared the queue.' });
}

const command: BotCommand = {
  name: 'stop',
  category: 'music',
  description: 'Stop playback and clear the queue',
  data,
  permissions: [],
  aliases: ['leave', 'dc'],
  execute,
  prefixExecute,
};

export default command;