import type { Attachment, Message } from 'discord.js';
import type { App } from '../core/context';
import type { AutomodModuleConfig, NsfwModerationConfig } from '../../../shared/src/index';
import { BoundedQueue } from './queue';
import { NsfwImageProcessor, isImageAttachment, type ScanResult } from './processor';
import { disposeNsfwModel, loadNsfwModel } from './model';
import type { NsfwClassifier, NsfwPrediction } from './types';

export type NsfwAction = 'review' | 'delete' | 'delete_failed' | 'log_only';

export interface NsfwServiceDeps {
  processor?: NsfwImageProcessor;
  queue?: BoundedQueue;
}

const MODEL_LOAD_TIMEOUT_MS = 5 * 60_000;
const SEEN_MAX = 2000;
const SEEN_TTL_MS = 5 * 60_000;

interface WorstScan {
  result: ScanResult;
  explicitScore: number;
  verdict: 'review' | 'delete';
  attachmentName: string;
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`timed out after ${Math.round(ms / 1000)}s`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

export class NsfwModerationService {
  private readonly app: App;
  private processor: NsfwImageProcessor | null = null;
  private readonly queue: BoundedQueue;
  private model: NsfwClassifier | null = null;
  private ready = false;
  private initPromise: Promise<void> | null = null;
  private readonly seen = new Map<string, number>();

  constructor(app: App, deps: NsfwServiceDeps = {}) {
    this.app = app;
    this.processor = deps.processor ?? null;
    this.queue = deps.queue ?? new BoundedQueue(this.cfg().queue_capacity, this.cfg().worker_concurrency);
    this.queue.onError = (err, jobId) => this.app.logger.warn(`NSFW job ${jobId} threw:`, err);
  }

  private cfg(): NsfwModerationConfig {
    return this.app.config.nsfw_moderation;
  }

  private requireModel(): NsfwClassifier {
    if (!this.model) throw new Error('NSFW model not ready');
    return this.model;
  }

  /** Loads the model once before any messages are processed. Never rejects:
   *  model failures disable the feature and are logged instead of crashing. */
  public async init(loader: () => Promise<NsfwClassifier> = loadNsfwModel): Promise<void> {
    if (this.initPromise) return this.initPromise;
    if (!this.cfg().enabled) {
      this.initPromise = Promise.resolve();
      return this.initPromise;
    }
    this.initPromise = (async () => {
      try {
        // Processor creation may fail if native modules (tfjs-node, sharp) are
        // missing — wrap it so the bot boots cleanly in either case.
        this.processor = this.processor ?? new NsfwImageProcessor({ getModel: async () => this.requireModel() });
        this.model = await withTimeout(loader(), MODEL_LOAD_TIMEOUT_MS);
        this.ready = true;
        this.app.logger.info('NSFW image moderation model loaded');
      } catch (err) {
        this.ready = false;
        this.processor = null;
        this.app.logger.error('NSFW model failed to load — image moderation disabled:', err);
        void this.app.logManager.reportError('NSFW model load failed', err);
      }
    })();
    return this.initPromise;
  }

  /** Message-event entry point. Never blocks or throws. */
  public async handleMessage(message: Message): Promise<void> {
    try {
      const cfg = this.cfg();
      if (!cfg.enabled || !this.ready || !this.processor) return;
      if (message.author.bot || message.webhookId) return;
      if (!message.inGuild() || message.attachments.size === 0) return;
      if (cfg.guilds.length > 0 && !cfg.guilds.includes(message.guildId ?? '')) return;
      if (cfg.ignored_channels.includes(message.channelId)) return;
      if (cfg.exempt_roles.length > 0) {
        const roleIds = message.member ? [...message.member.roles.cache.values()].map((r) => r.id) : null;
        if (roleIds && roleIds.some((id) => cfg.exempt_roles.includes(id))) return;
      }

      const automodIgnores = this.collectAutomodIgnores();
      if (automodIgnores.channels.has(message.channelId)) return;
      if (message.member) {
        const memberRoleIds = [...message.member.roles.cache.values()].map((r) => r.id);
        if (memberRoleIds.some((id) => automodIgnores.roles.has(id))) return;
      }

      const images = [...message.attachments.values()].filter((a) => isImageAttachment(a.name, a.contentType));
      if (images.length === 0) return;
      if (this.seen.has(message.id) || this.queue.has(message.id)) return;
      const accepted = this.queue.enqueue({ id: message.id, run: () => this.processMessage(message, images) });
      if (!accepted) {
        this.app.logger.warn(`NSFW queue full — dropped message ${message.id}`);
      }
    } catch (err) {
      this.app.logger.warn('NSFW handleMessage failed:', err);
    }
  }

  /** One queue job per message. Scans every image attachment and acts (delete
   *  + report, or report only) at most once per message. */
  private async processMessage(message: Message, images: Attachment[]): Promise<void> {
    const cfg = this.cfg();
    let worst: WorstScan | null = null;

    for (const attachment of images) {
      try {
        const result = await this.processor!.scan(attachment.url, {
          maxBytes: cfg.max_attachment_bytes,
          timeoutMs: cfg.download_timeout_ms,
        });
        const explicitScore = cfg.ignored_categories.length > 0
          ? this.computeExplicitScore(result.predictions, cfg.ignored_categories)
          : result.explicitScore;
        if (explicitScore >= cfg.delete_threshold) {
          worst = { result, explicitScore, verdict: 'delete', attachmentName: attachment.name ?? attachment.id };
          break;
        }
        if (explicitScore >= cfg.review_threshold && (!worst || explicitScore > worst.explicitScore)) {
          worst = { result, explicitScore, verdict: 'review', attachmentName: attachment.name ?? attachment.id };
        }
      } catch (err) {
        this.app.logger.warn(`NSFW scan failed for attachment ${attachment.id} (${attachment.name ?? 'unnamed'}): ${(err as Error).message}`);
      }
    }

    if (!worst) return;
    this.markSeen(message.id);

    if (cfg.log_only) {
      await this.createReport(message, worst, 'log_only', cfg);
      return;
    }

    if (worst.verdict === 'delete') {
      const deleted = await this.deleteMessage(message);
      await this.createReport(message, worst, deleted ? 'delete' : 'delete_failed', cfg);
    } else {
      await this.createReport(message, worst, 'review', cfg);
    }
  }

  private async deleteMessage(message: Message): Promise<boolean> {
    try {
      if (!message.deletable) return false;
      await message.delete();
      return true;
    } catch (err) {
      this.app.logger.warn(`NSFW delete failed for message ${message.id}:`, err);
      return false;
    }
  }

  /** Submits the moderator report through the existing report system — same
   *  destination, permissions, card, storage and configuration as manual
   *  reports. Never throws. */
  private async createReport(
    message: Message,
    worst: WorstScan,
    action: NsfwAction,
    cfg: NsfwModerationConfig,
  ): Promise<void> {
    const pct = (v: number): string => `${(v * 100).toFixed(2)}%`;
    const actionLabel =
      action === 'log_only' ? 'Log-only (test)' : action === 'delete_failed' ? 'Delete failed' : action === 'delete' ? 'Deleted' : 'Review';
    const triggeredThreshold =
      action === 'delete' || action === 'delete_failed' ? cfg.delete_threshold : action === 'review' ? cfg.review_threshold : null;

    const ignoredLine = cfg.ignored_categories.length > 0
      ? `Ignored categories: ${cfg.ignored_categories.join(', ')}`
      : '';

    const lines = [
      `**Automated image moderation**${cfg.log_only ? ' — **[TEST MODE — LOG ONLY]**' : ''}`,
      `User: <@${message.author.id}> (\`${message.author.id}\`)`,
      `Channel: <#${message.channelId}> (\`${message.channelId}\`)`,
      `Message: ${message.id}${message.url ? ` ([jump](${message.url}))` : ''}`,
      `Attachment: ${worst.attachmentName}`,
      '',
      '**NSFWJS scores**',
      ...worst.result.predictions.map((p) => `- ${p.className}: ${pct(p.probability)}`),
      cfg.ignored_categories.length > 0
        ? `Explicit (Porn + Hentai, filtered): **${pct(worst.explicitScore)}** — raw: ${pct(worst.result.explicitScore)}`
        : `Explicit (Porn + Hentai): **${pct(worst.explicitScore)}**`,
      triggeredThreshold !== null ? `Threshold: ${pct(triggeredThreshold)}` : `Threshold: review ${pct(cfg.review_threshold)} / delete ${pct(cfg.delete_threshold)}`,
      `Action: **${actionLabel}**`,
      action === 'delete_failed' ? 'Note: the unsafe message could not be deleted (missing Manage Messages permission).' : '',
      ignoredLine,
      `Timestamp: <t:${Math.floor(Date.now() / 1000)}:F>`,
    ];

    try {
      await this.app.reporting.createReport({
        guildId: message.guildId ?? '',
        reporterId: this.app.client.user?.id ?? '0',
        targetUserId: message.author.id,
        targetMessageId: message.id,
        reason: lines.filter(Boolean).join('\n'),
        targetContent: message.content ? message.content.slice(0, 1000) : null,
        sourceChannelId: message.channelId,
        sourceModule: 'nsfw',
        sourceRule:
          action === 'review'
            ? 'explicit_score >= review_threshold'
            : action === 'log_only'
              ? 'log_only mode'
              : 'explicit_score >= delete_threshold',
        attachmentUrls: [worst.result.url],
      });
    } catch (err) {
      this.app.logger.error(`NSFW report failed for message ${message.id}:`, err);
    }
  }

  private computeExplicitScore(predictions: NsfwPrediction[], ignoredCategories: string[]): number {
    return predictions
      .filter((p) => !ignoredCategories.includes(p.className))
      .filter((p) => p.className === 'Porn' || p.className === 'Hentai')
      .reduce((sum, p) => sum + p.probability, 0);
  }

  /** Union of all automod channel ignores + immune roles (global + per-module)
   *  so channels/roles that automod skips are also skipped by NSFW scanning. */
  private collectAutomodIgnores(): { channels: Set<string>; roles: Set<string> } {
    const channels = new Set<string>();
    const roles = new Set<string>();
    const automod = (this.app.config as Record<string, unknown>).automod as Record<string, unknown> | undefined;
    if (!automod) return { channels, roles };

    const globalRoles = automod.global_immune_roles;
    if (Array.isArray(globalRoles)) globalRoles.forEach((r) => roles.add(String(r)));

    const modules = automod.modules;
    if (modules && typeof modules === 'object') {
      for (const mod of Object.values(modules) as Record<string, unknown>[]) {
        if (Array.isArray(mod.channel_ignore_list)) mod.channel_ignore_list.forEach((c) => channels.add(String(c)));
        if (Array.isArray(mod.immune_roles)) mod.immune_roles.forEach((r) => roles.add(String(r)));
      }
    }
    return { channels, roles };
  }

  private markSeen(messageId: string): void {
    this.seen.set(messageId, Date.now());
    if (this.seen.size > SEEN_MAX) {
      const now = Date.now();
      for (const [id, at] of this.seen) {
        if (now - at > SEEN_TTL_MS) this.seen.delete(id);
      }
    }
  }

  /** Graceful shutdown: stop accepting new jobs, dispose the model. */
  public async shutdown(): Promise<void> {
    this.queue.stop();
    disposeNsfwModel();
  }
}