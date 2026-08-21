import { SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction, Message } from 'discord.js';
import type { App } from '../../core/context';
import type { BotCommand } from '../../types/command';
import { v2Reply, v2MessageReply } from '../../utils/v2';
import { getQueue, isUserInBotChannel } from '../../music/helpers';

const data = new SlashCommandBuilder().setName('resume').setDescription('Resume the current song');

async function run(app: App, guildId: string, member: any): Promise<string | null> {
  const queue = getQueue(app, guildId);
  if (!queue) return 'Nothing is playing right now.';
  if (!isUserInBotChannel(app, guildId, member)) return 'You must be in the same voice channel as the bot.';
  if (!queue.paused) return 'The song is not paused.';
  await queue.resume();
  await app.music.refreshPanel(guildId, queue);
  return null;
}

async function execute(interaction: ChatInputCommandInteraction, app: App): Promise<void> {
  const guild = interaction.guild;
  if (!guild) return;
  const error = await run(app, guild.id, interaction.member);
  await v2Reply(interaction, error ?? '▶ Resumed.', { ephemeral: !!error });
}

async function prefixExecute(message: Message, _args: string[], app: App): Promise<void> {
  const guild = message.guild;
  if (!guild) return;
  const error = await run(app, guild.id, message.member);
  await v2MessageReply(message, { content: error ?? '▶ Resumed.' });
}

const command: BotCommand = {
  name: 'resume',
  category: 'music',
  description: 'Resume the current song',
  data,
  permissions: [],
  aliases: [],
  execute,
  prefixExecute,
};

export default command;