import { SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction, Message } from 'discord.js';
import type { App } from '../../core/context';
import type { BotCommand } from '../../types/command';
import { v2Reply, v2MessageReply } from '../../utils/v2';
import { getQueue, isUserInBotChannel } from '../../music/helpers';
import { formatTime } from '../../music/panel';

const data = new SlashCommandBuilder()
  .setName('seek')
  .setDescription('Seek to a position in the current song')
  .addIntegerOption((o) =>
    o.setName('seconds').setDescription('Position in seconds').setMinValue(0).setRequired(true),
  );

async function run(app: App, guildId: string, member: any, seconds: number): Promise<string | null> {
  const queue = getQueue(app, guildId);
  if (!queue) return 'Nothing is playing right now.';
  if (!isUserInBotChannel(app, guildId, member)) return 'You must be in the same voice channel as the bot.';
  const song = queue.songs[0];
  if (song && song.duration && seconds > song.duration) {
    return `The song is only ${formatTime(song.duration)} long.`;
  }
  await queue.seek(seconds);
  await app.music.refreshPanel(guildId, queue);
  return `⏩ Seeked to **${formatTime(seconds)}**.`;
}

async function execute(interaction: ChatInputCommandInteraction, app: App): Promise<void> {
  const guild = interaction.guild;
  if (!guild) return;
  const seconds = interaction.options.getInteger('seconds', true);
  const error = await run(app, guild.id, interaction.member, seconds);
  await v2Reply(interaction, error ?? '', { ephemeral: !!error });
}

async function prefixExecute(message: Message, args: string[], app: App): Promise<void> {
  const guild = message.guild;
  if (!guild) return;
  const seconds = Math.max(0, parseInt(args[0] ?? '0', 10) || 0);
  const error = await run(app, guild.id, message.member, seconds);
  await v2MessageReply(message, { content: error ?? '' });
}

const command: BotCommand = {
  name: 'seek',
  category: 'music',
  description: 'Seek to a position in the current song',
  data,
  permissions: [],
  aliases: [],
  execute,
  prefixExecute,
};

export default command;