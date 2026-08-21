import { SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction, Message } from 'discord.js';
import type { App } from '../../core/context';
import type { BotCommand } from '../../types/command';
import { v2Reply, v2MessageReply } from '../../utils/v2';
import { getQueue, isUserInBotChannel } from '../../music/helpers';

const data = new SlashCommandBuilder().setName('autoplay').setDescription('Toggle autoplay (plays related songs)');

async function run(app: App, guildId: string, member: any): Promise<string | null> {
  const queue = getQueue(app, guildId);
  if (!queue) return 'Nothing is playing right now.';
  if (!isUserInBotChannel(app, guildId, member)) return 'You must be in the same voice channel as the bot.';
  const next = await app.music.toggleAutoplay(guildId);
  return `✨ Autoplay is now **${next ? 'ON' : 'OFF'}**.`;
}

async function execute(interaction: ChatInputCommandInteraction, app: App): Promise<void> {
  const guild = interaction.guild;
  if (!guild) return;
  const error = await run(app, guild.id, interaction.member);
  await v2Reply(interaction, error ?? '', { ephemeral: !!error });
}

async function prefixExecute(message: Message, _args: string[], app: App): Promise<void> {
  const guild = message.guild;
  if (!guild) return;
  const error = await run(app, guild.id, message.member);
  await v2MessageReply(message, { content: error ?? '' });
}

const command: BotCommand = {
  name: 'autoplay',
  category: 'music',
  description: 'Toggle autoplay',
  data,
  permissions: [],
  aliases: ['ap'],
  execute,
  prefixExecute,
};

export default command;