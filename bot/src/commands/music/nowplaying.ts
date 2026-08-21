import { SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction, Message } from 'discord.js';
import type { App } from '../../core/context';
import type { BotCommand } from '../../types/command';
import { v2Reply, v2MessageReply } from '../../utils/v2';
import { getQueue } from '../../music/helpers';
import { buildProgressBar, formatTime } from '../../music/panel';

const data = new SlashCommandBuilder().setName('nowplaying').setDescription('Show the currently playing song');

async function run(app: App, guildId: string): Promise<string> {
  const queue = getQueue(app, guildId);
  const song = queue?.songs[0];
  if (!queue || !song) return 'Nothing is playing right now.';
  const live = !song.duration || !Number.isFinite(song.duration);
  const bar = live ? '🔴 LIVE' : `${buildProgressBar(queue.currentTime, song.duration)}\n\`${formatTime(queue.currentTime)} / ${formatTime(song.duration)}\``;
  const requester = song.member?.user.tag ?? song.user?.tag ?? 'Unknown';
  const name = song.url ? `[${song.name ?? 'Unknown'}](${song.url})` : song.name ?? 'Unknown';
  return [
    `**Now playing:** ${name}`,
    bar,
    '',
    `🎧 ${requester} • 🔊 ${queue.volume}% • 🔁 Loop: ${['Off', 'Song', 'Queue'][queue.repeatMode] ?? 'Off'}`,
    `📃 ${queue.songs.length - 1} song(s) in queue • 🎚️ Filters: ${queue.filters.names.length ? queue.filters.names.join(', ') : 'Off'}`,
  ].join('\n');
}

async function execute(interaction: ChatInputCommandInteraction, app: App): Promise<void> {
  const guild = interaction.guild;
  if (!guild) return;
  await v2Reply(interaction, await run(app, guild.id), { ephemeral: true });
}

async function prefixExecute(message: Message, _args: string[], app: App): Promise<void> {
  const guild = message.guild;
  if (!guild) return;
  await v2MessageReply(message, { content: await run(app, guild.id) });
}

const command: BotCommand = {
  name: 'nowplaying',
  category: 'music',
  description: 'Show the currently playing song',
  data,
  permissions: [],
  aliases: ['np', 'playing'],
  execute,
  prefixExecute,
};

export default command;