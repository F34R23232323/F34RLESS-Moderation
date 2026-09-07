import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  type MessageActionRowComponentBuilder,
} from 'discord.js';
import type { Queue } from 'distube';
import { MUSIC_FILTERS, getMusicFilter } from './filters';
import type { MusicSettings } from './types';
import { applicationEmoji, emojiPrefix } from '../emoji';

const REPEAT_LABELS = ['Off', 'Song', 'Queue'] as const;

export function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const s = Math.floor(seconds % 60);
  const m = Math.floor((seconds / 60) % 60);
  const h = Math.floor(seconds / 3600);
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${m}:${ss}`;
}

export function buildProgressBar(current: number, total: number, size = 18): string {
  if (!total || !Number.isFinite(total)) return '🔴 LIVE';
  const pos = Math.max(0, Math.min(1, current / total));
  const filled = Math.round(pos * size);
  return '▬'.repeat(Math.max(0, filled - 1)) + '🔘' + '▬'.repeat(Math.max(0, size - filled));
}

export interface PanelPayload {
  embeds: EmbedBuilder[];
  components: ActionRowBuilder<MessageActionRowComponentBuilder>[];
}

export function buildPanelPayload(settings: MusicSettings, queue: Queue | null): PanelPayload {
  const embed = new EmbedBuilder().setColor(0x5865f2);
  const current = queue?.songs[0] ?? null;
  const idle = !queue || !current;

  if (idle) {
    embed.setTitle(`${emojiPrefix('gvMusic')}${settings.twentyFourSeven ? 'Idle — 24/7 active' : 'Nothing playing'}`);
    embed.setDescription(
      settings.twentyFourSeven
        ? 'The queue is empty and the bot stays in the voice channel 24/7.\nAdd a song with `/play` (or `!play`) to start.'
        : 'The queue is empty. Add a song with `/play` (or `!play`).',
    );
  } else {
    embed.setTitle(current.name ?? 'Unknown track');
    if (current.url) embed.setURL(current.url);
    if (current.thumbnail) embed.setThumbnail(current.thumbnail);

    const total = current.duration;
    const bar = buildProgressBar(queue.currentTime, total);
    const live = !total || !Number.isFinite(total);
    embed.setDescription(
      live ? '🔴 **LIVE**' : `${bar}\n\`${formatTime(queue.currentTime)} / ${formatTime(total)}\``,
    );

    const requester = current.member?.user.tag ?? current.user?.tag ?? 'Unknown';
    embed.addFields(
      { name: `${emojiPrefix('vyxiaUser')}Requester`, value: requester, inline: true },
      { name: `${emojiPrefix('vyxia_mic')}Volume`, value: `${queue.volume}%`, inline: true },
      { name: `${emojiPrefix('vyxia_settings')}Filters`, value: filtersLabel(queue), inline: true },
      { name: `${emojiPrefix('o_loop')}Loop`, value: REPEAT_LABELS[queue.repeatMode] ?? 'Off', inline: true },
      { name: `${emojiPrefix('o_autoplay')}Autoplay`, value: queue.autoplay ? 'On' : 'Off', inline: true },
      { name: `${emojiPrefix('system')}24/7`, value: settings.twentyFourSeven ? 'On' : 'Off', inline: true },
      { name: `${emojiPrefix('gvMusic')}Queue`, value: `${queue.songs.length - 1} song${queue.songs.length - 1 === 1 ? '' : 's'}`, inline: true },
    );
    if (current.uploader?.name) {
      embed.setFooter({ text: `Up next: ${queue.songs[1]?.name ?? 'nothing'}` });
      embed.setAuthor({ name: current.uploader.name, url: current.uploader.url });
    }
  }

  const rows: ActionRowBuilder<MessageActionRowComponentBuilder>[] = [];

  const row1 = new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
    setButtonEmoji(new ButtonBuilder()
      .setCustomId('music:pause')
      .setLabel(queue && !idle && queue.paused ? 'Resume' : 'Pause')
      .setStyle(queue && !idle && queue.paused ? ButtonStyle.Success : ButtonStyle.Secondary)
      .setDisabled(idle), queue && !idle && queue.paused ? 'o_resume' : 'o_pause'),
    setButtonEmoji(new ButtonBuilder().setCustomId('music:skip').setLabel('Skip').setStyle(ButtonStyle.Secondary).setDisabled(idle), 'o_skip'),
    setButtonEmoji(new ButtonBuilder().setCustomId('music:stop').setLabel('Stop').setStyle(ButtonStyle.Danger).setDisabled(idle), 'vyxia_cross'),
    setButtonEmoji(new ButtonBuilder()
      .setCustomId('music:shuffle')
      .setLabel('Shuffle')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(idle || queue.songs.length < 2), 'o_shuffle'),
    setButtonEmoji(new ButtonBuilder()
      .setCustomId('music:prev')
      .setLabel('Previous')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(idle), 'o_previous'),
  );
  rows.push(row1);

  const row2 = new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
    setButtonEmoji(new ButtonBuilder().setCustomId('music:vol:down').setLabel('Volume −').setStyle(ButtonStyle.Secondary), 'vyxia_mic'),
    setButtonEmoji(new ButtonBuilder().setCustomId('music:vol:up').setLabel('Volume +').setStyle(ButtonStyle.Secondary), 'vyxia_mic'),
    setButtonEmoji(new ButtonBuilder()
      .setCustomId('music:loop')
      .setLabel(`Loop: ${REPEAT_LABELS[queue?.repeatMode ?? 0]}`)
      .setStyle((queue?.repeatMode ?? 0) > 0 ? ButtonStyle.Primary : ButtonStyle.Secondary)
      .setDisabled(idle), 'o_loop'),
    setButtonEmoji(new ButtonBuilder()
      .setCustomId('music:autoplay')
      .setLabel(`Autoplay: ${queue ? (queue.autoplay ? 'On' : 'Off') : settings.autoplay ? 'On' : 'Off'}`)
      .setStyle(queue?.autoplay || (!queue && settings.autoplay) ? ButtonStyle.Primary : ButtonStyle.Secondary)
      .setDisabled(idle), 'o_autoplay'),
    setButtonEmoji(new ButtonBuilder()
      .setCustomId('music:247')
      .setLabel(`24/7: ${settings.twentyFourSeven ? 'On' : 'Off'}`)
      .setStyle(settings.twentyFourSeven ? ButtonStyle.Success : ButtonStyle.Secondary), 'system'),
  );
  rows.push(row2);

  const filterSelect = new StringSelectMenuBuilder()
    .setCustomId('music:filter')
    .setPlaceholder(queue?.filters.names.length ? `Filters: ${filtersLabel(queue)}` : 'No filters')
    .setDisabled(idle)
    .addOptions(
      new StringSelectMenuOptionBuilder()
        .setLabel('No filter')
        .setValue('off')
        .setDescription('Disable all filters')
        .setEmoji(applicationEmoji('disabled') ?? '🚫'),
      ...MUSIC_FILTERS.map((f) =>
        new StringSelectMenuOptionBuilder()
          .setLabel(f.label)
          .setValue(f.key)
          .setDescription(f.value)
          .setEmoji(f.emoji)
          .setDefault(queue?.filters.names.includes(f.key) ?? false),
      ),
    );

  // Select menus must live in their own action row — Discord does not allow
  // mixing a select menu with buttons in the same row.
  const filterRow = new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(filterSelect);
  rows.push(filterRow);

  const row4 = new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
    setButtonEmoji(new ButtonBuilder().setCustomId('music:refresh').setLabel('Refresh').setStyle(ButtonStyle.Secondary), 'o_replay'),
    setButtonEmoji(new ButtonBuilder().setCustomId('music:queue').setLabel('Queue').setStyle(ButtonStyle.Secondary).setDisabled(idle), 'gvMusic'),
  );
  rows.push(row4);

  return { embeds: [embed], components: rows };
}

function filtersLabel(queue: Queue): string {
  const names = queue.filters.names;
  if (names.length === 0) return 'Off';
  const labels = names
    .map((n) => {
      const def = getMusicFilter(n);
      return def ? def.label : n;
    })
    .join(', ');
  return labels.length > 100 ? `${labels.slice(0, 97)}...` : labels;
}

function setButtonEmoji(button: ButtonBuilder, name: string): ButtonBuilder {
  const resolved = applicationEmoji(name);
  return resolved ? button.setEmoji(resolved) : button;
}
