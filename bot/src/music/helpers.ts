import type { GuildMember, VoiceBasedChannel } from 'discord.js';
import type { Queue } from 'distube';
import type { App } from '../core/context';
import { formatTime } from './panel';

export function getMemberVoiceChannel(member: GuildMember | null | undefined): VoiceBasedChannel | null {
  return member?.voice?.channel ?? null;
}

export function getQueue(app: App, guildId: string): Queue | null {
  return app.music.distube.getQueue(guildId) ?? null;
}

export function isUserInBotChannel(app: App, guildId: string, member: GuildMember | null | undefined): boolean {
  const queue = getQueue(app, guildId);
  if (!queue?.voiceChannel) return false;
  return member?.voice?.channelId === queue.voiceChannel.id;
}

export function botCanJoin(channel: VoiceBasedChannel | null, app: App): boolean {
  if (!channel) return false;
  const me = channel.guild.members.me;
  if (!me) return false;
  const perms = channel.permissionsFor(me);
  if (!perms) return false;
  return perms.has('Connect') && perms.has('Speak');
}

export function queueListText(queue: Queue, page = 1, pageSize = 10): string {
  const total = queue.songs.length;
  if (total === 0) return 'The queue is empty.';
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.max(1, Math.min(pages, page));
  const start = (safePage - 1) * pageSize;
  const slice = queue.songs.slice(start, start + pageSize);
  const lines = slice.map((song, i) => {
    const idx = start + i + 1;
    const prefix = idx === 1 ? '▶' : `${idx}.`;
    const dur = song.isLive ? 'Live' : formatTime(song.duration);
    return `${prefix} **${song.name ?? 'Unknown'}** \`${dur}\` ${song.url ? `[link](${song.url})` : ''}`;
  });
  const totalDur = formatTime(queue.duration);
  return `${lines.join('\n')}\n\n**${total} song${total === 1 ? '' : 's'} • ${totalDur} total** — Page ${safePage}/${pages}`;
}