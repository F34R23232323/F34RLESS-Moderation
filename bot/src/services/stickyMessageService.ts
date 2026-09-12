import type { Message, TextBasedChannel } from 'discord.js';
import type { RowDataPacket } from 'mysql2/promise';
import { parseJson } from '../../../shared/src/index';
import type { App } from '../core/context';
import { buildMessagePayload, clientEmojiIds, type MessageSpec } from '../utils/messageBuilder';

export interface StickyMessageRow extends RowDataPacket {
  id: number;
  guild_id: string;
  channel_id: string;
  saved_message_id: number | null;
  payload: string | MessageSpec | null;
  message_id: string | null;
  enabled: number;
  repost_after_messages: number;
  delay_min_seconds: number;
  delay_max_seconds: number;
  conversation_detection: number;
  count_bot_messages: number;
  conversation_window_seconds: number;
  conversation_min_messages: number;
  quiet_period_seconds: number;
  min_interval_seconds: number;
  max_reposts_per_hour: number;
  delete_previous: number;
  messages_since_post: number;
  last_posted_at: Date | null;
}

interface ActivityState {
  events: Array<{ at: number; authorId: string }>;
  reposts: number[];
  timer?: NodeJS.Timeout;
  posting: boolean;
}

export class StickyMessageService {
  private readonly activity = new Map<string, ActivityState>();

  constructor(private readonly app: App) {}

  public async onMessage(message: Message): Promise<void> {
    if (!this.app.config.sticky_messages.enabled || !message.inGuild()) return;
    const sticky = await this.get(message.guildId, message.channelId);
    if (!sticky || !sticky.enabled || message.id === sticky.message_id) return;
    if (message.author.bot && !sticky.count_bot_messages) return;

    const state = this.state(message.channelId);
    if (message.author.id === this.app.client.user?.id && state.posting) return;
    const now = Date.now();
    const windowMs = sticky.conversation_window_seconds * 1_000;
    state.events = state.events.filter((event) => now - event.at <= windowMs);
    state.events.push({ at: now, authorId: message.author.id });
    await this.app.db.execute(
      'UPDATE sticky_messages SET messages_since_post = messages_since_post + 1 WHERE id = ?',
      [sticky.id],
    );
    sticky.messages_since_post++;
    if (sticky.messages_since_post < sticky.repost_after_messages) return;

    const looksLikeConversation = Boolean(sticky.conversation_detection) &&
      state.events.length >= sticky.conversation_min_messages && new Set(state.events.map((event) => event.authorId)).size >= 2;
    const configuredDelay = this.randomDelay(sticky.delay_min_seconds, sticky.delay_max_seconds);
    this.schedule(sticky, looksLikeConversation ? Math.max(configuredDelay, sticky.quiet_period_seconds * 1_000) : configuredDelay);
  }

  public async syncConfigured(): Promise<void> {
    for (const configured of this.app.config.sticky_messages.configured) {
      const channel = this.app.client.channels.cache.get(configured.channel_id);
      if (!channel || !('guildId' in channel) || !channel.guildId) {
        this.app.logger.warn(`Configured sticky channel ${configured.channel_id} is not cached`);
        continue;
      }
      const spec: MessageSpec = {
        kind: 'v1',
        embeds: [{ title: configured.title, description: configured.description, color: configured.color }],
      };
      await this.app.db.execute(
        `INSERT INTO sticky_messages
          (guild_id, channel_id, payload, enabled, repost_after_messages, delay_min_seconds, delay_max_seconds,
           conversation_detection, count_bot_messages, conversation_window_seconds, conversation_min_messages,
           quiet_period_seconds, min_interval_seconds, max_reposts_per_hour, delete_previous)
         VALUES (?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE payload = VALUES(payload), saved_message_id = NULL, enabled = 1,
           repost_after_messages = VALUES(repost_after_messages), delay_min_seconds = VALUES(delay_min_seconds),
           delay_max_seconds = VALUES(delay_max_seconds), conversation_detection = VALUES(conversation_detection),
           count_bot_messages = VALUES(count_bot_messages)`,
        [channel.guildId, configured.channel_id, JSON.stringify(spec), configured.repost_after_messages,
          configured.delay_min_seconds, configured.delay_max_seconds, configured.conversation_detection ? 1 : 0,
          configured.count_bot_messages ? 1 : 0, this.app.config.sticky_messages.conversation_window_seconds,
          this.app.config.sticky_messages.conversation_min_messages, this.app.config.sticky_messages.quiet_period_seconds,
          this.app.config.sticky_messages.min_interval_seconds, this.app.config.sticky_messages.max_reposts_per_hour,
          this.app.config.sticky_messages.delete_previous ? 1 : 0],
      );
      const sticky = await this.get(channel.guildId, configured.channel_id);
      if (sticky && !sticky.message_id) await this.post(sticky, true);
    }
  }

  public async get(guildId: string, channelId: string): Promise<StickyMessageRow | null> {
    const [rows] = await this.app.db.query<StickyMessageRow[]>(
      'SELECT * FROM sticky_messages WHERE guild_id = ? AND channel_id = ? LIMIT 1',
      [guildId, channelId],
    );
    return rows[0] ?? null;
  }

  public async post(sticky: StickyMessageRow, force = false): Promise<string | null> {
    const state = this.state(sticky.channel_id);
    if (state.posting) return null;
    state.posting = true;
    try {
      const now = Date.now();
      state.reposts = state.reposts.filter((at) => now - at < 3_600_000);
      const last = sticky.last_posted_at ? new Date(sticky.last_posted_at).getTime() : 0;
      if (!force && (now - last < sticky.min_interval_seconds * 1_000 || state.reposts.length >= sticky.max_reposts_per_hour)) {
        const intervalDelay = sticky.min_interval_seconds * 1_000 - (now - last);
        const hourlyDelay = state.reposts.length >= sticky.max_reposts_per_hour ? 3_600_000 - (now - state.reposts[0]) : 0;
        const delay = Math.max(1_000, intervalDelay, hourlyDelay);
        this.schedule(sticky, delay);
        return null;
      }

      const guild = this.app.client.guilds.cache.get(sticky.guild_id);
      const channel = guild?.channels.cache.get(sticky.channel_id);
      if (!channel?.isTextBased() || !('send' in channel)) return null;
      const spec = await this.resolveSpec(sticky);
      if (!spec) return null;
      const payload = buildMessagePayload(spec, String(sticky.saved_message_id ?? `sticky-${sticky.id}`), clientEmojiIds(this.app.client));

      if (sticky.delete_previous && sticky.message_id && 'messages' in channel) {
        const previous = await channel.messages.fetch(sticky.message_id).catch(() => null);
        if (previous && previous.author.id === this.app.client.user?.id) await previous.delete().catch(() => undefined);
      }
      const sent = await (channel as TextBasedChannel & { send: Function }).send({
        ...payload,
        allowedMentions: { parse: [] },
      } as never);
      await this.app.db.execute(
        'UPDATE sticky_messages SET message_id = ?, messages_since_post = 0, last_posted_at = NOW() WHERE id = ?',
        [sent.id, sticky.id],
      );
      state.events = [];
      state.reposts.push(now);
      return sent.id;
    } catch (err) {
      this.app.logger.error(`Failed to post sticky message ${sticky.id}:`, err);
      return null;
    } finally {
      state.posting = false;
    }
  }

  public cancel(channelId: string): void {
    const state = this.activity.get(channelId);
    if (state?.timer) clearTimeout(state.timer);
    this.activity.delete(channelId);
  }

  private schedule(sticky: StickyMessageRow, delayMs: number): void {
    const state = this.state(sticky.channel_id);
    if (state.timer) clearTimeout(state.timer);
    state.timer = setTimeout(() => {
      state.timer = undefined;
      void this.get(sticky.guild_id, sticky.channel_id).then((fresh) => {
        if (fresh?.enabled && fresh.messages_since_post >= fresh.repost_after_messages) void this.post(fresh);
      });
    }, Math.max(50, delayMs));
    state.timer.unref();
  }

  private state(channelId: string): ActivityState {
    let state = this.activity.get(channelId);
    if (!state) {
      state = { events: [], reposts: [], posting: false };
      this.activity.set(channelId, state);
    }
    return state;
  }

  private randomDelay(minSeconds: number, maxSeconds: number): number {
    const min = Math.max(0, minSeconds) * 1_000;
    const max = Math.max(minSeconds, maxSeconds) * 1_000;
    return min === max ? min : Math.floor(min + Math.random() * (max - min + 1));
  }

  private async resolveSpec(sticky: StickyMessageRow): Promise<MessageSpec | null> {
    if (sticky.saved_message_id) {
      const saved = await this.app.messages.get(sticky.saved_message_id);
      if (!saved || saved.guild_id !== sticky.guild_id) return null;
      return this.app.messages.parsePayload(saved);
    }
    if (!sticky.payload) return null;
    return typeof sticky.payload === 'string'
      ? parseJson(sticky.payload, null as unknown as MessageSpec)
      : sticky.payload;
  }
}
