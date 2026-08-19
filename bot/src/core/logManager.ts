import { EventEmitter } from 'events';
import { AttachmentBuilder } from 'discord.js';
import type { Pool } from 'mysql2/promise';
import type { App } from './context';
import { v2Send } from '../utils/v2';
import { buildRichV2 } from '../utils/v2';
import { friendlyEventName, formatDetails, logAccent } from './logFormatter';

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

export class LogManager extends EventEmitter {
  private readonly db: Pool;
  public app: App | null = null;

  constructor(db: Pool) {
    super();
    this.db = db;
  }

  public async log(input: LogInput): Promise<number | null> {
    try {
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
      await this.routeToDiscord(input);
      return insertId;
    } catch (err) {
      console.error('LogManager.log failed:', err);
      return null;
    }
  }

  private async routeToDiscord(input: LogInput): Promise<void> {
    const app = this.app;
    if (!app) return;
    const cfg = app.config.logging[input.event];
    if (!cfg || !cfg.enabled) return;
    const guild = app.client.guilds.cache.get(input.guildId);
    if (!guild) return;

    const channel =
      (cfg.thread_id && guild.channels.cache.get(cfg.thread_id)) ||
      (cfg.channel_id && guild.channels.cache.get(cfg.channel_id));
    if (!channel || !('send' in channel)) return;

    try {
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

      const rich = buildRichV2({
        accentColor: logAccent(input.event),
        header,
        text,
        footer: `${guild.name} • <t:${Math.floor(Date.now() / 1000)}:R>`,
        mediaUrls: input.mediaUrls?.length ? input.mediaUrls : undefined,
      });
      const files = input.files?.map((f) => new AttachmentBuilder(Buffer.isBuffer(f.data) ? f.data : Buffer.from(f.data), { name: f.name }));
      await channel.send({ ...rich, ...(files?.length ? { files } : {}), allowedMentions: { parse: [], repliedUser: false } } as never);
    } catch (err) {
      console.error(`Failed to route log ${input.event} to channel:`, err);
    }
  }

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

    const rich = buildRichV2({
      accentColor: 0xeb459e,
      header: `Automod: ${entry.module} — ${entry.rule}`,
      text: lines.join('\n'),
      footer: `${guild.name} • <t:${Math.floor(Date.now() / 1000)}:R>`,
    });
    await channel.send({ ...rich, allowedMentions: { parse: [], repliedUser: false } } as never).catch(() => undefined);
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
    if (cfg.channel_id) {
      const channel = app.client.channels.cache.get(cfg.channel_id);
      if (channel && 'send' in channel) {
        const verbosity = cfg.verbosity === 'verbose' ? cleaned : err instanceof Error ? err.message : cleaned.slice(0, 500);
        await v2Send(channel, `[Error] ${source}\n${verbosity.slice(0, 1800)}`, { accentColor: '#ED4245', allowedMentions: { parse: [], repliedUser: false } }).catch(() => undefined);
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
  }): Promise<void> {
    const app = this.app;
    await this.log({
      event: 'rate_limit_event',
      guildId: app?.config.bot.owner_ids[0] ?? '0',
      message: `Rate limited on ${data.method} ${data.route}${data.global ? ' (GLOBAL)' : ''} for ${data.timeout}ms`,
      details: data,
    }).catch(() => undefined);

    if (!app) return;
    const cfg = app.config.rate_limit_reporting;
    if (!cfg.enabled) return;
    const text = `Rate limited\nMethod: ${data.method}\nRoute: ${data.route}\nTimeout: ${data.timeout}ms\nGlobal: ${data.global}`;
    if (cfg.channel_id) {
      const channel = app.client.channels.cache.get(cfg.channel_id);
      if (channel && 'send' in channel) {
        await v2Send(channel, text, { accentColor: '#FEE75C', allowedMentions: { parse: [], repliedUser: false } }).catch(() => undefined);
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