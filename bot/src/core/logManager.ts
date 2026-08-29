import { EventEmitter } from 'events';
import { AttachmentBuilder, ChannelType } from 'discord.js';
import type { Guild, GuildBasedChannel, TextChannel, ThreadChannel } from 'discord.js';
import type { Pool } from 'mysql2/promise';
import type { App } from './context';
import { isLogIgnored, type LogIgnoreContext } from '../../../shared/src/index';
import type { LoggingEntryConfig } from '../../../shared/src/index';
import { v2Send } from '../utils/v2';
import { buildRichV2 } from '../utils/v2';
import { friendlyEventName, formatDetails, logAccent } from './logFormatter';

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
  message?: string;
  details?: unknown;
  mediaUrls?: string[];
  files?: Array<{ name: string; data: Buffer | string }>;
}

interface QueuedEntry {
  input: LogInput;
  header: string;
  text: string;
  timestamp: number;
}

const FLUSH_INTERVAL_MS = 500;
const MAX_BATCH_SIZE = 25;

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
      this.enqueueLog(input);
      return insertId;
    } catch (err) {
      console.error('LogManager.log failed:', err);
      return null;
    }
  }

  // ── Per-channel batch queue ──────────────────────────────────────────────

  private enqueueLog(input: LogInput): void {
    const cfg = this.eventConfig(input.event);
    if (!cfg || !cfg.enabled) return;
    const guild = this.app?.client.guilds.cache.get(input.guildId);
    if (!guild) return;

    const channel =
      (cfg.thread_id && guild.channels.cache.get(cfg.thread_id)) ||
      (cfg.channel_id && guild.channels.cache.get(cfg.channel_id));
    if (!channel || !('send' in channel)) return;

    const header = friendlyEventName(input.event);
    const lines: string[] = [];
    if (input.message) lines.push(input.message);
    if (input.channelId && !input.message?.includes(`<#${input.channelId}>`)) {
      lines.push(`**Channel:** <#${input.channelId}>`);
    }
    if (input.actorId) lines.push(`**Actor:** <@${input.actorId}>`);
    if (input.targetId) lines.push(`**User:** <@${input.targetId}>`);
    lines.push(...formatDetails(input.details, guild));

    const details = input.details as Record<string, unknown> | null | undefined;
    const messageId = details && typeof details.messageId === 'string' ? details.messageId : null;
    if (messageId && input.channelId) {
      lines.push(`**Link:** <https://discord.com/channels/${input.guildId}/${input.channelId}/${messageId}>`);
    }

    let text = lines.join('\n') || input.event;
    if (text.length > 3800) text = `${text.slice(0, 3800)}… (+${text.length - 3800} chars)`;

    const queueKey = `${input.guildId}:${channel.id}`;
    const entry: QueuedEntry = { input, header, text, timestamp: Date.now() };
    const queue = this.pendingLogs.get(queueKey);
    if (queue) {
      queue.push(entry);
      if (queue.length >= MAX_BATCH_SIZE) void this.flushLogs(queueKey);
    } else {
      this.pendingLogs.set(queueKey, [entry]);
    }
    this.scheduleFlush(queueKey);
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

  private async flushLogs(key: string): Promise<void> {
    const queue = this.pendingLogs.get(key);
    if (!queue || queue.length === 0) return;
    this.pendingLogs.delete(key);

    const app = this.app;
    if (!app) return;

    const [guildId, channelId] = key.split(':');
    const guild = app.client.guilds.cache.get(guildId);
    if (!guild) return;
    const channel = guild.channels.cache.get(channelId);
    if (!channel || !('send' in channel)) return;

    try {
      if (queue.length === 1) {
        const e = queue[0];
        const rich = buildRichV2({
          accentColor: logAccent(e.input.event),
          header: e.header,
          text: e.text,
          footer: `${guild.name} • <t:${Math.floor(Date.now() / 1000)}:R>`,
          mediaUrls: e.input.mediaUrls?.length ? e.input.mediaUrls : undefined,
        });
        const files = e.input.files?.map((f) => new AttachmentBuilder(Buffer.isBuffer(f.data) ? f.data : Buffer.from(f.data), { name: f.name }));
        await channel.send({ ...rich, ...(files?.length ? { files } : {}), allowedMentions: { parse: [], repliedUser: false } } as never);
      } else {
        const sections: string[] = [];
        for (const e of queue) {
          sections.push(`**${e.header}**\n${e.text}`);
        }
        let text = sections.join('\n\n');
        if (text.length > 3700) text = `${text.slice(0, 3700)}…`;

        const rich = buildRichV2({
          accentColor: 0x5865f2,
          header: `${queue.length} log events`,
          text,
          footer: `${guild.name} • <t:${Math.floor(Date.now() / 1000)}:R>`,
        });
        await channel.send({ ...rich, allowedMentions: { parse: [], repliedUser: false } } as never);
      }
    } catch (err) {
      console.error(`Failed to flush batched logs to channel ${channelId}:`, err);
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

    const lines: string[] = [`**User:** <@${entry.userId}>`];
    if (entry.channelId) lines.push(`**Channel:** <#${entry.channelId}>`);
    if (entry.messageId && entry.channelId) {
      lines.push(`**Link:** <https://discord.com/channels/${entry.guildId}/${entry.channelId}/${entry.messageId}>`);
    }
    if (entry.contentSnippet) lines.push(`**Matched:** ${entry.contentSnippet.slice(0, 800)}`);
    const taken = entry.actionsTaken as string[] | null | undefined;
    if (Array.isArray(taken) && taken.length > 0) lines.push(`**Actions:** ${taken.join(', ')}`);
    const failed = entry.actionsFailed as Array<{ step?: string; error?: string }> | null | undefined;
    if (Array.isArray(failed) && failed.length > 0) {
      lines.push(`**Failed:** ${failed.map((f) => `${f.step ?? 'step'} (${f.error ?? 'unknown'})`).join('; ')}`);
    }
    if (Array.isArray(entry.caseIds) && entry.caseIds.length > 0) lines.push(`**Cases:** ${entry.caseIds.join(', ')}`);
    if (entry.archiveLink) lines.push(`**Evidence:** ${entry.archiveLink}`);
    if (entry.responseSuppressed) lines.push(`**Response:** suppressed by throttle`);

    let text = lines.join('\n');
    if (text.length > 3800) text = `${text.slice(0, 3800)}…`;

    // Route through the same per-channel batch queue
    const queueKey = `${entry.guildId}:${channel.id}`;
    const queued: QueuedEntry = {
      input: { event: 'automod_trigger', guildId: entry.guildId },
      header: `Automod: ${entry.module} — ${entry.rule}`,
      text,
      timestamp: Date.now(),
    };
    const queue = this.pendingLogs.get(queueKey);
    if (queue) {
      queue.push(queued);
      if (queue.length >= MAX_BATCH_SIZE) void this.flushLogs(queueKey);
    } else {
      this.pendingLogs.set(queueKey, [queued]);
    }
    this.scheduleFlush(queueKey);
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
    const content = `[Error] ${source}\n${verbosity.slice(0, 1800)}`;

    if (cfg.channel_id) {
      const channel = app.client.channels.cache.get(cfg.channel_id);
      if (channel && 'send' in channel) {
        const sent = await v2Send(channel, content, { accentColor: '#ED4245', allowedMentions: { parse: [], repliedUser: false } })
          .then(() => true)
          .catch(() => false);
        if (sent) return;
      }
    }
    if (cfg.webhook_url) {
      await this.postWebhook(cfg.webhook_url, { content: `[Error] ${source}\n${cleaned.slice(0, 1900)}` }).catch(() => undefined);
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

    const lines = ['Rate limited', `Method: ${data.method}`, `Route: ${data.route}`, `Timeout: ${data.timeout}ms`, `Global: ${data.global}`];
    if (data.bucket) lines.push(`Bucket: ${data.bucket}`);
    if (data.origin) {
      lines.push(`Source: ${data.origin.file}`);
      lines.push(`Feature: ${data.origin.feature}`);
    }
    const text = lines.join('\n');

    if (cfg.channel_id) {
      const channel = app.client.channels.cache.get(cfg.channel_id);
      if (channel && 'send' in channel) {
        const sent = await v2Send(channel, text, { accentColor: '#FEE75C', allowedMentions: { parse: [], repliedUser: false } })
          .then(() => true)
          .catch(() => false);
        if (sent) return;
      }
    }
    if (cfg.webhook_url) {
      await this.postWebhook(cfg.webhook_url, { content: text }).catch(() => undefined);
    }
  }

  private async postWebhook(url: string, payload: { content: string }): Promise<void> {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`Webhook returned ${res.status}`);
  }
}