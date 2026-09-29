import { EventEmitter } from 'events';
import { AttachmentBuilder, ChannelType, EmbedBuilder } from 'discord.js';
import type { Guild, GuildBasedChannel, TextChannel, ThreadChannel, User } from 'discord.js';
import type { Pool } from 'mysql2/promise';
import type { App } from './context';
import { isLogIgnored, type LogIgnoreContext } from '../../../shared/src/index';
import type { LoggingEntryConfig } from '../../../shared/src/index';
import { friendlyEventName } from './logFormatter';
import { buildLogEmbed, packByBudget, type LogEmbedSource } from './logEmbed';

export interface RateLimitOrigin {
  file: string;
  feature: string;
}

export interface LogInput {
  event: string;
  guildId: string;
  channelId?: string | null;
  actorId?: string | null;
  targetId?: string | null;
  /** Optional display tag for the target (e.g. "bKcYCsf") — appended to the
   *  embed title to produce Sapphire-style "Kick bKcYCsf" headers. */
  targetTag?: string | null;
  message?: string;
  details?: unknown;
  mediaUrls?: string[];
  files?: Array<{ name: string; data: Buffer | string }>;
}

interface QueuedEntry {
  source: LogEmbedSource & { files?: LogInput['files'] };
  /** When the event happened (ms) — not when it is sent. */
  timestamp: number;
  logId: number | null;
  /** Send attempts so far — entries survive transient failures. */
  attempts: number;
}

const FLUSH_INTERVAL_MS = 500;
/** At this many pending entries for one channel, flush immediately instead of
 *  waiting for the debounce — bursts still go out as one packed message. */
const MERGE_THRESHOLD = 3;
const MAX_QUEUE_SIZE = 500;
const MAX_SEND_ATTEMPTS = 3;
const RETRY_BASE_DELAY_MS = 2_000;
/** Discord: max 10 embeds and ~6000 chars per message. */
const MAX_EMBEDS_PER_MESSAGE = 10;
const MAX_MESSAGE_CHARS = 5800;
const MAX_FILES_PER_MESSAGE = 10;

export class LogManager extends EventEmitter {
  private readonly db: Pool;
  public app: App | null = null;
  /** Per-channel log queue — entries are batched and flushed together. */
  private readonly pendingLogs = new Map<string, QueuedEntry[]>();
  private readonly flushTimers = new Map<string, NodeJS.Timeout>();

  constructor(db: Pool) {
    super();
    this.db = db;
  }

  /** Per-event log config, with fallbacks for combined events so existing
   *  configs keep working (role_change reuses the role_add channel/ignore). */
  private eventConfig(event: string): LoggingEntryConfig | undefined {
    const app = this.app;
    if (!app) return undefined;
    return app.config.logging[event] ?? (event === 'role_change' ? app.config.logging.role_add : undefined);
  }

  /**
   * Decide whether an event should be suppressed by the global logging_ignore
   * or the event's own ignore block. Roles are only resolved when some ignore
   * list actually references roles (saves API lookups on every log line).
   */
  private async shouldIgnore(
    event: string,
    guildId: string,
    input: { channelId?: string | null; actorId?: string | null; targetId?: string | null },
  ): Promise<boolean> {
    const app = this.app;
    if (!app) return false;
    const global = app.config.logging_ignore;
    const perEvent = this.eventConfig(event)?.ignore;
    if (!global && !perEvent) return false;

    const guild = app.client.guilds.cache.get(guildId);
    const ctx: LogIgnoreContext = {
      channelId: input.channelId ?? null,
      actorId: input.actorId ?? null,
      targetId: input.targetId ?? null,
      categoryId: null,
      actorRoleIds: null,
      targetRoleIds: null,
    };
    if (guild && input.channelId) {
      ctx.categoryId = await this.resolveCategoryId(guild, input.channelId);
    }
    const needRoles = [global, perEvent].some((s) => s && s.roles.length > 0);
    if (needRoles && guild) {
      if (input.actorId) ctx.actorRoleIds = await this.memberRoleIds(guild, input.actorId);
      if (input.targetId) ctx.targetRoleIds = await this.memberRoleIds(guild, input.targetId);
    }
    return isLogIgnored(global, ctx) || isLogIgnored(perEvent, ctx);
  }

  private async memberRoleIds(guild: Guild, userId: string): Promise<Set<string> | null> {
    try {
      const member = guild.members.cache.get(userId) ?? (await guild.members.fetch(userId).catch(() => null));
      if (!member) return null;
      return new Set(member.roles.cache.keys());
    } catch {
      return null;
    }
  }

  /**
   * Resolve the category a channel belongs to. Walks up the parent chain so
   * that messages posted in threads/forums inside a category are attributed to
   * that category (a single-level parentId lookup would only reach the parent
   * channel, not the category itself). Fetches channels from the API if they
   * are not in the cache.
   */
  private async resolveCategoryId(guild: Guild, channelId: string): Promise<string | null> {
    let channel: GuildBasedChannel | null =
      guild.channels.cache.get(channelId) ?? (await guild.channels.fetch(channelId).catch(() => null));
    if (!channel) return null;
    let guard = 0;
    while (channel && channel.parentId && guard < 10) {
      const parent: GuildBasedChannel | null =
        guild.channels.cache.get(channel.parentId) ?? (await guild.channels.fetch(channel.parentId).catch(() => null));
      if (!parent) break;
      channel = parent;
      guard++;
    }
    return channel && channel.type === ChannelType.GuildCategory ? channel.id : null;
  }

  public async log(input: LogInput): Promise<number | null> {
    try {
      if (await this.shouldIgnore(input.event, input.guildId, input)) return null;
      const [result] = await this.db.execute(
        `INSERT INTO logs (event, guild_id, channel_id, actor_id, target_id, message, details)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          input.event,
          input.guildId,
          input.channelId ?? null,
          input.actorId ?? null,
          input.targetId ?? null,
          input.message ?? null,
          input.details ? JSON.stringify(input.details) : null,
        ],
      );
      this.emit('log', { ...input });
      const insertId = (result as { insertId: number }).insertId;
      this.enqueueLog(input, insertId);
      return insertId;
    } catch (err) {
      console.error('LogManager.log failed:', err);
      return null;
    }
  }

  // ── Per-channel batch queue ──────────────────────────────────────────────

  private enqueueLog(input: LogInput, logId: number | null = null): void {
    const cfg = this.eventConfig(input.event);
    if (!cfg || !cfg.enabled) return;
    const guild = this.app?.client.guilds.cache.get(input.guildId);
    if (!guild) return;

    const channel =
      (cfg.thread_id && guild.channels.cache.get(cfg.thread_id)) ||
      (cfg.channel_id && guild.channels.cache.get(cfg.channel_id));
    if (!channel || !('send' in channel)) return;

    const details = input.details as Record<string, unknown> | null | undefined;
    let header = friendlyEventName(input.event);
    const caseCode = (details?.caseCode ?? details?.case_code) as string | undefined;
    if (
      caseCode &&
      typeof caseCode === 'string' &&
      ['member_kick', 'member_ban', 'member_unban', 'member_mute', 'member_timeout', 'member_warn', 'member_unwarn', 'softban'].includes(input.event)
    ) {
      header = `${friendlyEventName(input.event)} ${caseCode}`;
    } else if (typeof details?.channelTypeTitle === 'string') {
      header = details.channelTypeTitle;
    } else if (input.targetTag) {
      header = `${friendlyEventName(input.event)} ${input.targetTag}`;
    }

    const entry: QueuedEntry = {
      source: {
        header,
        event: input.event,
        guildId: input.guildId,
        channelId: input.channelId,
        actorId: input.actorId,
        targetId: input.targetId,
        message: input.message,
        details: input.details,
        mediaUrls: input.mediaUrls,
        files: input.files,
      },
      timestamp: Date.now(),
      logId,
      attempts: 0,
    };
    this.pushEntry(`${input.guildId}:${channel.id}`, entry);

  }

  private pushEntry(queueKey: string, entry: QueuedEntry): void {
    let queue = this.pendingLogs.get(queueKey);
    if (!queue) {
      queue = [];
      this.pendingLogs.set(queueKey, queue);
    }
    queue.push(entry);
    // Hard cap: drop the oldest overflow rather than growing without bound.
    if (queue.length > MAX_QUEUE_SIZE) queue.splice(0, queue.length - MAX_QUEUE_SIZE);
    if (queue.length >= MERGE_THRESHOLD) {
      this.clearFlushTimer(queueKey);
      void this.flushLogs(queueKey);
    } else {
      this.scheduleFlush(queueKey);
    }
  }

  private clearFlushTimer(key: string): void {
    const timer = this.flushTimers.get(key);
    if (timer) {
      clearTimeout(timer);
      this.flushTimers.delete(key);
    }
  }

  private scheduleFlush(key: string): void {
    if (this.flushTimers.has(key)) return;
    const timer = setTimeout(() => {
      this.flushTimers.delete(key);
      void this.flushLogs(key);
    }, FLUSH_INTERVAL_MS);
    timer.unref?.();
    this.flushTimers.set(key, timer);
  }

  /** Best-effort avatar URL for the thumbnail — cache first, then fetch. */
  private async resolveAvatar(userId: string | null | undefined): Promise<string | null> {
    const user = await this.resolveUser(userId);
    return user ? user.displayAvatarURL({ size: 128 }) : null;
  }

  /** Best-effort user lookup — cache first, then fetch. */
  private async resolveUser(userId: string | null | undefined): Promise<User | null> {
    const app = this.app;
    if (!app || !userId) return null;
    const cached = app.client.users.cache.get(userId);
    return cached ?? await app.client.users.fetch(userId).catch(() => null);
  }

  private async flushLogs(key: string): Promise<void> {
    const queue = this.pendingLogs.get(key);
    if (!queue || queue.length === 0) return;

    const app = this.app;
    if (!app) return;

    const [guildId, channelId] = key.split(':');
    const guild = app.client.guilds.cache.get(guildId);
    const channel = guild?.channels.cache.get(channelId);
    if (!guild || !channel || !('send' in channel)) {
      this.pendingLogs.delete(key);
      return;
    }

    // Take the whole batch out; failed sends are re-queued for retry.
    const batch = queue.splice(0, queue.length);
    if (queue.length === 0) this.pendingLogs.delete(key);

    try {
      await this.sendBatch(channel, guild, batch);
    } catch (err) {
      this.requeueFailed(key, batch, err);
    }
  }

  /** Re-queue a failed batch with backoff, or give up and report after
   *  MAX_SEND_ATTEMPTS so transient rate limits never lose log entries. */
  private requeueFailed(key: string, batch: QueuedEntry[], err: unknown): void {
    for (const e of batch) e.attempts++;
    const remaining = batch.filter((e) => e.attempts < MAX_SEND_ATTEMPTS);
    if (remaining.length === 0) {
      this.app?.logger.error(`Dropped ${batch.length} log entries for ${key} after ${MAX_SEND_ATTEMPTS} attempts:`, err);
      void this.app?.logManager.reportError(`log flush ${key}`, err).catch(() => undefined);
      return;
    }
    let queue = this.pendingLogs.get(key);
    if (!queue) {
      queue = [];
      this.pendingLogs.set(key, queue);
    }
    // Preserve original ordering: failed entries go back to the front.
    queue.unshift(...remaining);
    if (this.flushTimers.has(key)) return; // a flush is already scheduled
    const delay = RETRY_BASE_DELAY_MS * Math.max(...remaining.map((e) => e.attempts), 1);
    const timer = setTimeout(() => {
      this.flushTimers.delete(key);
      void this.flushLogs(key);
    }, delay);
    timer.unref?.();
    this.flushTimers.set(key, timer);
  }

  /** Build one embed per entry, pack them into message-sized groups (≤10
   *  embeds, ≤~6000 chars), and send. Files travel with their entry's pack. */
  private async sendBatch(channel: any, guild: Guild, batch: QueuedEntry[]): Promise<void> {
    const built: Array<{ embed: EmbedBuilder; entry: QueuedEntry }> = [];
    for (const entry of batch) {
      // Only show a user avatar thumbnail for member/user events (matches Sapphire).
      // Channel, message, webhook, emoji, and server events never show a thumbnail.
      const shouldHaveThumbnail = [
        'member_kick',
        'member_ban',
        'member_unban',
        'member_mute',
        'member_timeout',
        'member_warn',
        'member_unwarn',
        'role_add',
        'role_remove',
        'role_change',
        'member_join',
        'member_leave',
        'member_avatar_update',
        'nickname_change',
      ].includes(entry.source.event);
      const thumbnailUrl = shouldHaveThumbnail && entry.source.targetId
        ? await this.resolveAvatar(entry.source.targetId)
        : null;
      const actor = entry.source.actorId ? await this.resolveUser(entry.source.actorId) : null;

      const embed = buildLogEmbed(entry.source, {
        guildName: guild.name,
        guildIconUrl: guild.iconURL({ size: 64 }),
        thumbnailUrl,
        logId: entry.logId,
        timestamp: entry.timestamp,
        actorName: actor?.username ?? null,
        actorAvatarUrl: actor ? actor.displayAvatarURL({ size: 64 }) : null,
      }, guild);
      built.push({ embed, entry });
    }

    const packs = packByBudget(built, (b) => JSON.stringify(b.embed.toJSON()).length);
    for (const pack of packs) {
      const files = pack.flatMap((b) => b.entry.source.files ?? [])
        .slice(0, MAX_FILES_PER_MESSAGE)
        .map((f) => new AttachmentBuilder(Buffer.isBuffer(f.data) ? f.data : Buffer.from(f.data), { name: f.name }));
      await channel.send({
        embeds: pack.map((b) => b.embed),
        ...(files.length ? { files } : {}),
        allowedMentions: { parse: [], repliedUser: false },
      } as never);
    }
  }

  // ── Automod logging ────────────────────────────────────────────────────────


  public async logAutomodTrigger(entry: {
    guildId: string;
    rule: string;
    module: string;
    userId: string;
    channelId?: string | null;
    messageId?: string | null;
    contentSnippet?: string | null;
    storedContent?: string | null;
    actionsTaken: unknown;
    actionsFailed: unknown;
    responseSuppressed: boolean;
    caseIds: string[];
    archiveCode?: string | null;
    archiveLink?: string | null;
  }): Promise<void> {
    try {
      await this.db.execute(
        `INSERT INTO automod_logs (guild_id, rule, module, user_id, channel_id, message_id, content_snippet, stored_content, actions_taken, actions_failed, response_suppressed, case_ids, archive_code)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          entry.guildId,
          entry.rule,
          entry.module,
          entry.userId,
          entry.channelId ?? null,
          entry.messageId ?? null,
          entry.contentSnippet ?? null,
          entry.storedContent ?? null,
          JSON.stringify(entry.actionsTaken),
          JSON.stringify(entry.actionsFailed),
          entry.responseSuppressed ? 1 : 0,
          JSON.stringify(entry.caseIds),
          entry.archiveCode ?? null,
        ],
      );
      this.emit('automod_log', entry);
      await this.routeAutomodLogToDiscord(entry);
    } catch (err) {
      console.error('logAutomodTrigger failed:', err);
    }
  }

  private async routeAutomodLogToDiscord(entry: {
    guildId: string;
    rule: string;
    module: string;
    userId: string;
    channelId?: string | null;
    messageId?: string | null;
    contentSnippet?: string | null;
    actionsTaken: unknown;
    actionsFailed: unknown;
    responseSuppressed: boolean;
    caseIds: string[];
    archiveCode?: string | null;
    archiveLink?: string | null;
  }): Promise<void> {
    const app = this.app;
    if (!app) return;
    const guild = app.client.guilds.cache.get(entry.guildId);
    if (!guild) return;

    const moduleCfg = app.config.automod.modules[entry.module as keyof typeof app.config.automod.modules];
    const targetId = moduleCfg?.log_channel_id || app.config.automod.log_channel_id;
    const threadId = moduleCfg?.log_thread_id || app.config.automod.log_thread_id;
    const channel = (threadId && guild.channels.cache.get(threadId)) || (targetId && guild.channels.cache.get(targetId));
    if (!channel || !('send' in channel)) return;

    // Structured details — the shared embed builder renders these as fields.
    const details: Record<string, unknown> = { rule: entry.rule, module: entry.module };
    if (entry.contentSnippet) details.contentSnippet = entry.contentSnippet.slice(0, 800);
    const taken = entry.actionsTaken as string[] | null | undefined;
    if (Array.isArray(taken) && taken.length > 0) details.actionsTaken = taken.join(', ');
    const failed = entry.actionsFailed as Array<{ step?: string; error?: string }> | null | undefined;
    if (Array.isArray(failed) && failed.length > 0) {
      details.actionsFailed = failed.map((f) => `${f.step ?? 'step'} (${f.error ?? 'unknown'})`).join('; ');
    }
    if (Array.isArray(entry.caseIds) && entry.caseIds.length > 0) details.caseIds = entry.caseIds.join(', ');
    if (entry.archiveLink) details.archiveLink = entry.archiveLink;
    if (entry.responseSuppressed) details.responseSuppressed = 'suppressed by throttle';
    if (entry.messageId) details.messageId = entry.messageId;

    const queued: QueuedEntry = {
      source: {
        header: `Automod: ${entry.module} — ${entry.rule}`,
        event: 'automod_trigger',
        guildId: entry.guildId,
        channelId: entry.channelId,
        targetId: entry.userId,
        details,
      },
      timestamp: Date.now(),
      logId: null,
      attempts: 0,
    };
    this.pushEntry(`${entry.guildId}:${channel.id}`, queued);
  }

  public async logCommandUsage(entry: {
    guildId: string | null;
    command: string;
    userId: string;
    surface: 'slash' | 'prefix';
    success: boolean;
    durationMs?: number;
    error?: string | null;
  }): Promise<void> {
    try {
      await this.db.execute(
        `INSERT INTO command_usage (guild_id, command, user_id, surface, success, duration_ms, error)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [entry.guildId, entry.command, entry.userId, entry.surface, entry.success ? 1 : 0, entry.durationMs ?? null, entry.error ?? null],
      );
    } catch (err) {
      console.error('logCommandUsage failed:', err);
    }
  }

  public async reportError(source: string, err: unknown): Promise<void> {
    const app = this.app;
    const message = err instanceof Error ? `${err.name}: ${err.message}\n${err.stack ?? ''}` : String(err);
    const cleaned = message.slice(0, 3000);
    await this.log({
      event: 'error_event',
      guildId: app?.config.bot.owner_ids[0] ?? '0',
      message: `[${source}] ${cleaned}`,
      details: { source, stack: message },
    }).catch(() => undefined);

    if (!app) return;
    const cfg = app.config.error_reporting;
    if (!cfg.enabled) return;

    const verbosity = cfg.verbosity === 'verbose' ? cleaned : err instanceof Error ? err.message : cleaned.slice(0, 500);
    const embed = new EmbedBuilder()
      .setColor(0xed4245)
      .setTitle(`❌ Error — ${source}`)
      .setDescription(verbosity.slice(0, 3900))
      .setFooter({ text: 'Error report' })
      .setTimestamp();

    if (cfg.channel_id) {
      const channel = app.client.channels.cache.get(cfg.channel_id);
      if (channel && 'send' in channel) {
        const sent = await channel.send({ embeds: [embed], allowedMentions: { parse: [], repliedUser: false } } as never)
          .then(() => true)
          .catch(() => false);
        if (sent) return;
      }
    }
    if (cfg.webhook_url) {
      await this.postWebhook(cfg.webhook_url, { embeds: [embed.toJSON()] }).catch(() => undefined);
    }
  }

  public async reportRateLimit(data: {
    route: string;
    method: string;
    timeout: number;
    global: boolean;
    bucket?: string | null;
    origin?: RateLimitOrigin | null;
  }): Promise<void> {
    const app = this.app;
    const originLine = data.origin ? ` (from ${data.origin.file} — ${data.origin.feature})` : '';
    await this.log({
      event: 'rate_limit_event',
      guildId: app?.config.bot.owner_ids[0] ?? '0',
      message: `Rate limited on ${data.method} ${data.route}${data.global ? ' (GLOBAL)' : ''} for ${data.timeout}ms${originLine}`,
      details: data,
    }).catch(() => undefined);

    if (!app) return;
    const cfg = app.config.rate_limit_reporting;
    if (!cfg.enabled) return;

    const fields: Array<{ name: string; value: string; inline: boolean }> = [
      { name: 'Method', value: data.method, inline: true },
      { name: 'Route', value: data.route.slice(0, 256), inline: true },
      { name: 'Timeout', value: `${data.timeout}ms`, inline: true },
      { name: 'Global', value: data.global ? 'Yes' : 'No', inline: true },
    ];
    if (data.bucket) fields.push({ name: 'Bucket', value: data.bucket.slice(0, 256), inline: false });
    if (data.origin) {
      fields.push({ name: 'Source', value: data.origin.file.slice(0, 256), inline: true });
      fields.push({ name: 'Feature', value: data.origin.feature.slice(0, 256), inline: true });
    }
    const embed = new EmbedBuilder()
      .setColor(0xfee75c)
      .setTitle('⏳ Rate limited')
      .addFields(fields)
      .setFooter({ text: 'Rate limit report' })
      .setTimestamp();

    if (cfg.channel_id) {
      const channel = app.client.channels.cache.get(cfg.channel_id);
      if (channel && 'send' in channel) {
        const sent = await channel.send({ embeds: [embed], allowedMentions: { parse: [], repliedUser: false } } as never)
          .then(() => true)
          .catch(() => false);
        if (sent) return;
      }
    }
    if (cfg.webhook_url) {
      await this.postWebhook(cfg.webhook_url, { embeds: [embed.toJSON()] }).catch(() => undefined);
    }
  }

  private async postWebhook(url: string, payload: { content?: string; embeds?: unknown[] }): Promise<void> {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`Webhook returned ${res.status}`);
  }
}