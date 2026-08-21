import { DisTube, Events, type Queue, type Song } from 'distube';
import { YouTubePlugin } from '@distube/youtube';
import { SpotifyPlugin } from '@distube/spotify';
import { SoundCloudPlugin } from '@distube/soundcloud';
import ffmpegStatic from 'ffmpeg-static';
import * as fs from 'fs';
import type { GuildMember, GuildTextBasedChannel, VoiceBasedChannel, VoiceState } from 'discord.js';
import type { RowDataPacket } from 'mysql2/promise';
import type { App } from '../core/context';
import { parseJson } from '../../../shared/src/index';
import { toCustomFilters } from './filters';
import { buildPanelPayload } from './panel';
import type { MusicSettings, PanelRef } from './types';

/** Resolve the ffmpeg binary to hand to DisTube.
 *  Prefers the bundled `ffmpeg-static` binary when present (local dev), otherwise
 *  falls back to `FFMPEG_PATH` / system `ffmpeg` on PATH — this keeps Docker images
 *  working where npm runs with `--ignore-scripts` so the ffmpeg-static binary is
 *  never downloaded. */
function resolveFfmpegPath(): string | undefined {
  if (typeof ffmpegStatic === 'string' && ffmpegStatic.length > 0) {
    try {
      if (fs.existsSync(ffmpegStatic)) return ffmpegStatic;
    } catch {
      // fall through to system ffmpeg
    }
  }
  return process.env.FFMPEG_PATH || 'ffmpeg';
}

export interface PlayResult {
  newQueue: boolean;
  count: number;
  name: string | undefined;
  url: string | undefined;
}

export class MusicService {
  public readonly distube: DisTube;
  private readonly settingsCache = new Map<string, MusicSettings>();
  private readonly panels = new Map<string, PanelRef>();
  private readonly idleGuilds = new Set<string>();
  private readonly restoring = new Set<string>();
  private panelTimer: ReturnType<typeof setInterval> | null = null;

  constructor(public readonly app: App) {
    const { env, config } = app;
    const ffmpegPath = resolveFfmpegPath();
    this.distube = new DisTube(app.client, {
      plugins: [
        new YouTubePlugin(),
        new SpotifyPlugin({
          api: {
            clientId: env.SPOTIFY_CLIENT_ID,
            clientSecret: env.SPOTIFY_CLIENT_SECRET,
          },
        }),
        new SoundCloudPlugin(),
      ],
      customFilters: toCustomFilters(),
      emitNewSongOnly: true,
      savePreviousSongs: true,
      joinNewVoiceChannel: true,
      nsfw: true,
      ffmpeg: ffmpegPath ? { path: ffmpegPath } : undefined,
    });
    this.registerEvents();
    this.panelTimer = setInterval(() => {
      void this.refreshProgress();
    }, Math.max(5, config.music.panel_refresh_seconds) * 1000);
  }

  // ---------------------------------------------------------------------------
  // Settings
  // ---------------------------------------------------------------------------

  public async getSettings(guildId: string): Promise<MusicSettings> {
    const cached = this.settingsCache.get(guildId);
    if (cached) return cached;
    const { config } = this.app;
    let settings: MusicSettings;
    try {
      const [rows] = await this.app.db.query<RowDataPacket[]>(
        'SELECT * FROM music_settings WHERE guild_id = ?',
        [guildId],
      );
      if (rows.length > 0) {
        const r = rows[0];
        settings = {
          guildId,
          twentyFourSeven: Boolean(r.twenty_four_seven) || config.music.twenty_four_seven,
          volume: typeof r.volume === 'number' ? r.volume : config.music.default_volume,
          textChannelId: r.text_channel_id ?? config.music.text_channel_id ?? null,
          voiceChannelId: r.voice_channel_id ?? null,
          autoplay: Boolean(r.autoplay) || config.music.autoplay,
          queue: r.queue ? (parseJson(r.queue, null) as MusicSettings['queue']) : null,
        };
      } else {
        settings = {
          guildId,
          twentyFourSeven: config.music.twenty_four_seven,
          volume: config.music.default_volume,
          textChannelId: config.music.text_channel_id ?? null,
          voiceChannelId: null,
          autoplay: config.music.autoplay,
          queue: null,
        };
        await this.app.db
          .execute(
            'INSERT INTO music_settings (guild_id, volume, text_channel_id) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE guild_id = guild_id',
            [guildId, settings.volume, settings.textChannelId],
          )
          .catch(() => undefined);
      }
    } catch (err) {
      this.app.logger.warn(`[music] failed to load settings for ${guildId}`, err);
      settings = {
        guildId,
        twentyFourSeven: config.music.twenty_four_seven,
        volume: config.music.default_volume,
        textChannelId: config.music.text_channel_id ?? null,
        voiceChannelId: null,
        autoplay: config.music.autoplay,
        queue: null,
      };
    }
    this.settingsCache.set(guildId, settings);
    return settings;
  }

  public async updateSettings(guildId: string, patch: Partial<MusicSettings>): Promise<MusicSettings> {
    const current = await this.getSettings(guildId);
    const next: MusicSettings = { ...current, ...patch };
    this.settingsCache.set(guildId, next);
    await this.app.db
      .execute(
        `UPDATE music_settings
         SET twenty_four_seven = ?, volume = ?, text_channel_id = ?, voice_channel_id = ?, autoplay = ?, queue = ?
         WHERE guild_id = ?`,
        [
          next.twentyFourSeven ? 1 : 0,
          next.volume,
          next.textChannelId,
          next.voiceChannelId,
          next.autoplay ? 1 : 0,
          next.queue ? JSON.stringify(next.queue) : null,
          guildId,
        ],
      )
      .catch((err: Error) => this.app.logger.warn(`[music] settings write failed for ${guildId}`, err));
    return next;
  }

  // ---------------------------------------------------------------------------
  // Playback control
  // ---------------------------------------------------------------------------

  public async play(
    guildId: string,
    voiceChannel: VoiceBasedChannel,
    query: string,
    member: GuildMember,
    textChannel?: GuildTextBasedChannel,
  ): Promise<PlayResult> {
    const { config } = this.app;
    const settings = await this.getSettings(guildId);
    const existing = this.distube.getQueue(guildId);
    const beforeCount = existing?.songs.length ?? 0;
    const max = config.music.max_queue_size;
    if (existing && existing.songs.length >= max) {
      throw new Error('queue-full');
    }
    await this.distube.play(voiceChannel, query, { member, textChannel });
    const queue = this.distube.getQueue(guildId);
    const count = (queue?.songs.length ?? 0) - beforeCount;
    const added = queue?.songs[beforeCount] ?? queue?.songs[0];
    if (settings.twentyFourSeven) {
      await this.persistQueue(queue);
    }
    return {
      newQueue: !existing,
      count,
      name: added?.name,
      url: added?.url,
    };
  }

  public async stop(guildId: string): Promise<void> {
    const queue = this.distube.getQueue(guildId);
    if (queue) await queue.stop();
    await this.clearPersistedQueue(guildId);
    const settings = await this.getSettings(guildId);
    if (settings.twentyFourSeven) {
      this.idleGuilds.add(guildId);
      await this.refreshPanel(guildId, null);
    } else {
      this.distube.voices.leave(guildId);
      this.panels.delete(guildId);
      await this.updateSettings(guildId, { voiceChannelId: null });
    }
  }

  public async setFilter(guildId: string, key: string | 'off'): Promise<boolean> {
    const queue = this.distube.getQueue(guildId);
    if (!queue) return false;
    if (key === 'off') {
      queue.filters.clear();
    } else {
      queue.filters.set([key]);
    }
    await this.refreshPanel(guildId, queue);
    return true;
  }

  public async setVolume(guildId: string, level: number): Promise<number> {
    const queue = this.distube.getQueue(guildId);
    const max = this.app.config.music.max_volume;
    const clamped = Math.max(0, Math.min(max, Math.round(level)));
    if (queue) queue.setVolume(clamped);
    await this.updateSettings(guildId, { volume: clamped });
    await this.refreshPanel(guildId, queue ?? null);
    return clamped;
  }

  public async set247(guildId: string, enabled: boolean): Promise<MusicSettings> {
    const settings = await this.updateSettings(guildId, { twentyFourSeven: enabled });
    const queue = this.distube.getQueue(guildId);
    if (!enabled && !queue) {
      this.idleGuilds.delete(guildId);
      this.panels.delete(guildId);
      this.distube.voices.leave(guildId);
      await this.updateSettings(guildId, { voiceChannelId: null });
    }
    if (enabled && queue) {
      await this.persistQueue(queue);
    }
    await this.refreshPanel(guildId, queue ?? null);
    return settings;
  }

  public async toggleAutoplay(guildId: string): Promise<boolean> {
    const queue = this.distube.getQueue(guildId);
    const settings = await this.getSettings(guildId);
    const next = !(queue ? queue.autoplay : settings.autoplay);
    if (queue) queue.autoplay = next;
    await this.updateSettings(guildId, { autoplay: next });
    await this.refreshPanel(guildId, queue ?? null);
    return next;
  }

  // ---------------------------------------------------------------------------
  // Persistence (24/7 restart restore)
  // ---------------------------------------------------------------------------

  private async persistQueue(queue: Queue | undefined | null): Promise<void> {
    if (!queue) return;
    const settings = await this.getSettings(queue.id);
    if (!settings.twentyFourSeven) return;
    const songs = queue.songs.map((s) => ({ url: s.url ?? s.id, name: s.name ?? s.url }));
    const voiceChannelId = queue.voiceChannel?.id ?? settings.voiceChannelId;
    await this.updateSettings(queue.id, { queue: { songs }, voiceChannelId });
  }

  private async clearPersistedQueue(guildId: string): Promise<void> {
    await this.updateSettings(guildId, { queue: null });
  }

  public async restoreAll(): Promise<void> {
    try {
      const [rows] = await this.app.db.query<RowDataPacket[]>(
        'SELECT guild_id FROM music_settings WHERE twenty_four_seven = 1 AND voice_channel_id IS NOT NULL',
      );
      for (const row of rows) {
        await this.restoreGuild(String(row.guild_id));
      }
    } catch (err) {
      this.app.logger.warn('[music] restoreAll failed', err);
    }
  }

  public async restoreGuild(guildId: string): Promise<void> {
    if (this.restoring.has(guildId)) return;
    this.restoring.add(guildId);
    try {
      const settings = await this.getSettings(guildId);
      if (!settings.twentyFourSeven || !settings.voiceChannelId) return;
      const guild = this.app.client.guilds.cache.get(guildId);
      if (!guild) return;
      const channel =
        guild.channels.cache.get(settings.voiceChannelId) ??
        (await guild.channels.fetch(settings.voiceChannelId).catch(() => null));
      if (!channel || !channel.isVoiceBased()) return;
      await this.distube.voices.join(channel as VoiceBasedChannel);
      const me = guild.members.me;
      const songs = settings.queue?.songs ?? [];
      if (me && songs.length > 0) {
        for (const item of songs) {
          if (!item.url) continue;
          await this.distube.play(channel as VoiceBasedChannel, item.url, { member: me });
        }
        const queue = this.distube.getQueue(guildId);
        if (queue) {
          queue.setVolume(settings.volume);
          queue.autoplay = settings.autoplay;
        }
      } else {
        this.idleGuilds.add(guildId);
      }
      await this.refreshPanel(guildId, this.distube.getQueue(guildId) ?? null);
    } catch (err) {
      this.app.logger.warn(`[music] restoreGuild failed for ${guildId}`, err);
    } finally {
      this.restoring.delete(guildId);
    }
  }

  // ---------------------------------------------------------------------------
  // Panel
  // ---------------------------------------------------------------------------

  public async refreshPanel(guildId: string, queue: Queue | null = this.distube.getQueue(guildId) ?? null): Promise<void> {
    try {
      const settings = await this.getSettings(guildId);
      const channelId = settings.textChannelId ?? queue?.textChannel?.id;
      if (!channelId) return;
      const guild = this.app.client.guilds.cache.get(guildId);
      const channel = guild?.channels.cache.get(channelId);
      if (!channel || !channel.isTextBased()) return;
      const payload = buildPanelPayload(settings, queue);
      const ref = this.panels.get(guildId);
      if (ref && ref.channelId === channelId) {
        const msg = await channel.messages.fetch(ref.messageId).catch(() => null);
        if (msg) {
          await msg.edit(payload).catch(() => undefined);
          return;
        }
        this.panels.delete(guildId);
      }
      const sent = await channel.send(payload).catch(() => null);
      if (sent) this.panels.set(guildId, { channelId, messageId: sent.id });
    } catch (err) {
      this.app.logger.warn(`[music] refreshPanel failed for ${guildId}`, err);
    }
  }

  public async clearPanel(guildId: string): Promise<void> {
    const ref = this.panels.get(guildId);
    if (!ref) return;
    this.panels.delete(guildId);
    const guild = this.app.client.guilds.cache.get(guildId);
    const channel = guild?.channels.cache.get(ref.channelId);
    if (!channel || !channel.isTextBased()) return;
    await channel.messages.fetch(ref.messageId).catch(() => null);
  }

  private async refreshProgress(): Promise<void> {
    for (const [guildId, ref] of this.panels) {
      const queue = this.distube.getQueue(guildId);
      if (!queue || !queue.songs[0] || queue.paused) continue;
      const settings = await this.getSettings(guildId);
      const guild = this.app.client.guilds.cache.get(guildId);
      const channel = guild?.channels.cache.get(ref.channelId);
      if (!channel || !channel.isTextBased()) {
        this.panels.delete(guildId);
        continue;
      }
      const msg = await channel.messages.fetch(ref.messageId).catch(() => null);
      if (!msg) {
        this.panels.delete(guildId);
        continue;
      }
      const payload = buildPanelPayload(settings, queue);
      await msg.edit(payload).catch(() => undefined);
    }
  }

  // ---------------------------------------------------------------------------
  // Notifications
  // ---------------------------------------------------------------------------

  public async notify(guildId: string, content: string): Promise<void> {
    try {
      const settings = await this.getSettings(guildId);
      const queue = this.distube.getQueue(guildId);
      const guild = this.app.client.guilds.cache.get(guildId);
      const channelId = settings.textChannelId ?? queue?.textChannel?.id;
      const channel = channelId ? guild?.channels.cache.get(channelId) : null;
      if (channel && channel.isTextBased()) {
        await channel.send({ content }).catch(() => undefined);
      }
    } catch (err) {
      this.app.logger.warn(`[music] notify failed for ${guildId}`, err);
    }
  }

  public friendlyError(error: Error): string {
    const msg = error.message ?? String(error);
    if (msg.includes('queue-full')) return `❌ The queue is full (max ${this.app.config.music.max_queue_size} songs).`;
    if (msg.includes('NO_RESULT') || msg.includes('no result')) return '❌ No results found for that search.';
    if (msg.includes('VOICE_CONNECT_FAILED') || msg.includes('Cannot join voice channel'))
      return '❌ Could not join that voice channel — check my Connect permission and that it exists.';
    if (msg.includes('VOICE_RECONNECT_FAILED')) return '❌ Failed to reconnect to the voice channel.';
    if (msg.includes('QUEUE_STOPPED')) return '⏹ The queue is stopped — add a song to start again.';
    if (msg.includes('NO_UP_NEXT')) return '⏭ There is no up-next song to skip to.';
    if (msg.includes('EMPTY_FILTERED_PLAYLIST') || msg.includes('age-restricted'))
      return '🔞 Some videos were filtered (age-restricted content requires an age-restricted channel).';
    if (msg.includes('ENCRYPTION_LIBRARIES_MISSING') || msg.includes('sodium'))
      return '❌ Voice encryption libraries are missing on the host (sodium).';
    if (msg.includes('Video unavailable') || msg.includes('private video') || msg.includes('copyright'))
      return '❌ That video is unavailable, private, or blocked by copyright.';
    if (msg.includes('EMPTY_PLAYLIST')) return '❌ That playlist could not be resolved or is empty.';
    if (msg.includes('Rate limit') || msg.includes('429')) return '⚠️ YouTube/Spotify is rate-limiting us — try again in a minute.';
    return `❌ An error occurred: ${msg.slice(0, 200)}`;
  }

  // ---------------------------------------------------------------------------
  // Voice state integration
  // ---------------------------------------------------------------------------

  public onVoiceStateUpdate(oldState: VoiceState, newState: VoiceState): void {
    const guildId = newState.guild.id;
    const botId = this.app.client.user?.id;
    if (!botId) return;
    const memberId = newState.member?.id ?? oldState.member?.id;
    if (!memberId) return;
    if (memberId !== botId) {
      void this.checkEmpty(guildId);
      return;
    }
    if (newState.channelId === null) {
      void this.handleBotDisconnected(guildId);
    }
  }

  private async checkEmpty(guildId: string): Promise<void> {
    try {
      const settings = await this.getSettings(guildId);
      const me = this.app.client.guilds.cache.get(guildId)?.members.me;
      const botChannel = me?.voice.channel;
      if (!botChannel) return;
      const humans = botChannel.members.filter((m) => !m.user.bot).size;
      if (humans > 0) return;
      const queue = this.distube.getQueue(guildId);
      if (queue) {
        if (settings.twentyFourSeven) return;
        await queue.stop();
        this.distube.voices.leave(guildId);
        this.panels.delete(guildId);
      } else if (!settings.twentyFourSeven) {
        this.distube.voices.leave(guildId);
      }
    } catch (err) {
      this.app.logger.warn(`[music] checkEmpty failed for ${guildId}`, err);
    }
  }

  private async handleBotDisconnected(guildId: string): Promise<void> {
    const settings = await this.getSettings(guildId);
    if (!settings.twentyFourSeven) return;
    setTimeout(() => {
      void this.restoreGuild(guildId);
    }, 2500);
  }

  // ---------------------------------------------------------------------------
  // DisTube events
  // ---------------------------------------------------------------------------

  private registerEvents(): void {
    const d = this.distube;
    d.on(Events.INIT_QUEUE, (queue) => {
      void this.onInitQueue(queue);
    });
    d.on(Events.PLAY_SONG, (queue, song) => {
      void this.onPlaySong(queue, song);
    });
    d.on(Events.ADD_SONG, (queue) => {
      void this.onQueueChanged(queue);
    });
    d.on(Events.ADD_LIST, (queue) => {
      void this.onQueueChanged(queue);
    });
    d.on(Events.FINISH_SONG, (queue) => {
      void this.onQueueChanged(queue);
    });
    d.on(Events.FINISH, (queue) => {
      void this.onFinish(queue);
    });
    d.on(Events.DISCONNECT, (queue) => {
      void this.onDisconnect(queue);
    });
    d.on(Events.ERROR, (error, queue) => {
      void this.onError(error, queue);
    });
    d.on(Events.NO_RELATED, (queue) => {
      void this.notify(queue.id, '❌ Autoplay could not find a related song.');
    });
  }

  private async onInitQueue(queue: Queue): Promise<void> {
    const settings = await this.getSettings(queue.id);
    this.idleGuilds.delete(queue.id);
    const guild = this.app.client.guilds.cache.get(queue.id);
    if (settings.textChannelId && guild) {
      const ch = guild.channels.cache.get(settings.textChannelId);
      if (ch && ch.isTextBased()) queue.textChannel = ch as GuildTextBasedChannel;
    }
    if (settings.volume >= 0) queue.setVolume(settings.volume);
    queue.autoplay = settings.autoplay;
    const vcId = queue.voiceChannel?.id;
    if (vcId) await this.updateSettings(queue.id, { voiceChannelId: vcId });
  }

  private async onPlaySong(queue: Queue, _song: Song): Promise<void> {
    await this.persistQueue(queue);
    await this.refreshPanel(queue.id, queue);
  }

  private async onQueueChanged(queue: Queue): Promise<void> {
    await this.persistQueue(queue);
    await this.refreshPanel(queue.id, queue);
  }

  private async onFinish(queue: Queue): Promise<void> {
    const settings = await this.getSettings(queue.id);
    await this.clearPersistedQueue(queue.id);
    if (settings.twentyFourSeven) {
      this.idleGuilds.add(queue.id);
      await this.refreshPanel(queue.id, null);
    } else {
      this.distube.voices.leave(queue.id);
      this.panels.delete(queue.id);
      await this.updateSettings(queue.id, { voiceChannelId: null });
    }
  }

  private async onDisconnect(queue: Queue): Promise<void> {
    const settings = await this.getSettings(queue.id);
    this.idleGuilds.delete(queue.id);
    if (settings.twentyFourSeven) {
      void this.restoreGuild(queue.id);
    } else {
      this.panels.delete(queue.id);
      await this.clearPersistedQueue(queue.id);
      await this.updateSettings(queue.id, { voiceChannelId: null });
    }
  }

  private async onError(error: Error, queue: Queue | undefined): Promise<void> {
    this.app.logger.error('[music] DisTube error', error);
    if (queue) {
      await this.notify(queue.id, this.friendlyError(error));
      await this.refreshPanel(queue.id, this.distube.getQueue(queue.id) ?? null);
    }
  }
}