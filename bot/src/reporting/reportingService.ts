import type { RowDataPacket } from 'mysql2/promise';
import type { App } from '../core/context';
import { buildReportCard } from '../utils/v2';
import { parseJson } from '../../../shared/src/index';

export interface ReportInput {
  guildId: string;
  reporterId: string;
  targetUserId?: string | null;
  targetMessageId?: string | null;
  reason?: string;
  targetContent?: string | null;
  sourceChannelId?: string | null;
  sourceModule?: string | null;
  sourceRule?: string | null;
  attachmentUrls?: string[];
}

export interface ResolveOptions {
  action?: string;
  reason?: string;
  duration?: string;
}

const IMAGE_RE = /\.(png|jpe?g|gif|webp)(\?.*)?$/i;

function mergeReportReasons(existing: unknown, next: string | undefined): string | null {
  if (!next?.trim()) return existing ? String(existing) : null;
  const existingText = existing ? String(existing) : '';
  const existingLines = existingText.split('\n').map((l) => l.trim());
  if (!existingLines.includes(next.trim())) {
    return existingText ? `${existingText}\n${next.trim()}` : next.trim();
  }
  return existingText || next.trim();
}

export class ReportingService {
  private readonly app: App;

  constructor(app: App) {
    this.app = app;
  }

  public async createReport(input: ReportInput): Promise<{ id: number; merged: boolean }> {
    const cfg = this.app.config.reports;
    if (!cfg.enabled) return { id: 0, merged: false };

const existing = await this.findDuplicate(input);
    if (existing) {
      const [reasonRows] = await this.app.db.query<RowDataPacket[]>('SELECT reason FROM reports WHERE id = ?', [existing.id]);
      const mergedReason = mergeReportReasons(reasonRows[0]?.reason, input.reason);
      await this.app.db.execute('UPDATE reports SET reporter_count = reporter_count + 1, reason = ? WHERE id = ?', [mergedReason, existing.id]);
      await this.updateReportCard(existing.id, input.guildId);
      return { id: existing.id, merged: true };
    }

    const [result] = await this.app.db.execute(
      `INSERT INTO reports (guild_id, reporter_id, target_user_id, target_message_id, reason, target_content, source_channel_id, source_module, source_rule, attachment_urls)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        input.guildId,
        input.reporterId,
        input.targetUserId ?? null,
        input.targetMessageId ?? null,
        input.reason ?? null,
        input.targetContent ?? null,
        input.sourceChannelId ?? null,
        input.sourceModule ?? null,
        input.sourceRule ?? null,
        input.attachmentUrls?.length ? JSON.stringify(input.attachmentUrls) : null,
      ],
    );
    const id = (result as { insertId: number }).insertId;
    await this.postReportCard(id, input.guildId);

    await this.app.db.execute(
      `INSERT INTO reporter_stats (guild_id, user_id) VALUES (?, ?)
       ON DUPLICATE KEY UPDATE user_id = VALUES(user_id)`,
      [input.guildId, input.reporterId],
    );

    await this.app.logManager.log({
      event: 'report_created',
      guildId: input.guildId,
      actorId: input.reporterId,
      targetId: input.targetUserId,
      message: `Report #${id} created by <@${input.reporterId}>`,
      details: { reason: input.reason, module: input.sourceModule, rule: input.sourceRule, channelId: input.sourceChannelId },
    });

    return { id, merged: false };
  }

  private async findDuplicate(input: ReportInput): Promise<{ id: number } | null> {
    const cfg = this.app.config.reports;
    const [rows] = await this.app.db.query<RowDataPacket[]>(
      `SELECT id FROM reports
       WHERE guild_id = ? AND status = 'open'
         AND created_at > DATE_SUB(NOW(), INTERVAL ? SECOND)
         AND (
           (target_message_id IS NOT NULL AND target_message_id = ?) OR
           (target_user_id IS NOT NULL AND target_user_id = ?)
         )
       LIMIT 1`,
      [input.guildId, cfg.merge_window_seconds, input.targetMessageId ?? null, input.targetUserId ?? null],
    );
    return (rows[0] as { id: number }) ?? null;
  }

private async loadReport(reportId: number): Promise<RowDataPacket | null> {
    const [rows] = await this.app.db.query<RowDataPacket[]>(
      'SELECT * FROM reports WHERE id = ?',
      [reportId],
    );
    return rows[0] ?? null;
  }

  private async buildCard(
    reportId: number,
    guildId: string,
  ): Promise<{ report: RowDataPacket; channel: any; card: ReturnType<typeof buildReportCard> } | null> {
    const app = this.app;
    const cfg = app.config.reports;
    const report = await this.loadReport(reportId);
    if (!report) return null;
    const guild = app.client.guilds.cache.get(guildId);
    if (!guild) return null;
    const channel = cfg.channel_id && guild.channels.cache.get(cfg.channel_id);
    if (!channel || !('send' in channel)) return null;

    const attachments = parseJson(report.attachment_urls, []) as string[];
    const imageUrl = attachments.find((a) => IMAGE_RE.test(a)) ?? null;

    // Fetch target user for avatar + account creation date
    const targetId: string | null = report.target_user_id ? String(report.target_user_id) : null;
    let targetAvatarUrl: string | null = imageUrl;
    let targetCreatedAt: number | null = null;
    let targetJoinedAt: number | null = null;
    let targetTag: string | null = null;

    if (targetId) {
      const user = await app.client.users.fetch(targetId).catch(() => null);
      if (user) {
        targetAvatarUrl = user.displayAvatarURL({ size: 128, extension: 'png' });
        targetCreatedAt = Math.floor(user.createdTimestamp / 1000);
        targetTag = user.tag ?? user.username;
      }
      const member = await guild.members.fetch(targetId).catch(() => null);
      if (member?.joinedAt) {
        targetJoinedAt = Math.floor(member.joinedAt.getTime() / 1000);
      }
    }

    // Last moderation case for this user
    let lastCaseType: string | null = null;
    let lastCaseAt: number | null = null;
    if (targetId) {
      const [caseRows] = await app.db.query<RowDataPacket[]>(
        'SELECT type, created_at FROM cases WHERE guild_id = ? AND user_id = ? ORDER BY created_at DESC LIMIT 1',
        [guildId, targetId],
      );
      const lastCase = caseRows[0];
      if (lastCase) {
        lastCaseType = String(lastCase.type).toUpperCase();
        lastCaseAt = Math.floor(new Date(lastCase.created_at).getTime() / 1000);
      }
    }

    // Reporter display name
    const reporter = await app.client.users.fetch(String(report.reporter_id)).catch(() => null);
    const reporterTag = reporter?.tag ?? reporter?.username ?? String(report.reporter_id);

    const pingRoleId = (cfg as { ping_role_id?: string }).ping_role_id;
    const card = buildReportCard({
      status: 'open',
      reportId,
      reporterCount: Number(report.reporter_count) || 1,
      targetId,
      targetTag,
      targetAvatarUrl,
      targetCreatedAt,
      targetJoinedAt,
      lastCaseType,
      lastCaseAt,
      reason: report.reason ? String(report.reason) : null,
      targetContent: report.target_content ? String(report.target_content) : null,
      sourceChannelId: report.source_channel_id ? String(report.source_channel_id) : null,
      targetMessageId: report.target_message_id ? String(report.target_message_id) : null,
      guildId,
      reporterTag,
      reporterId: String(report.reporter_id),
      imageUrl,
      pingRoleId: pingRoleId ?? null,
    });

    return { report, channel, card };
  }

  private async postReportCard(reportId: number, guildId: string): Promise<void> {
    const built = await this.buildCard(reportId, guildId);
    if (!built) return;
    const { report, channel, card } = built;

    await (channel as any).send(card).then(async (sent: any) => {
      if (sent?.id) {
        await this.app.db.execute('UPDATE reports SET channel_message_id = ? WHERE id = ?', [sent.id, reportId]);
      }
    }).catch(() => undefined);
  }

  /** Re-render an existing report card in place so merged reports stay as 1 embed. */
  private async updateReportCard(reportId: number, guildId: string): Promise<void> {
    const built = await this.buildCard(reportId, guildId);
    if (!built) return;
    const { report, channel, card } = built;

    const messageId = report.channel_message_id ? String(report.channel_message_id) : null;
    if (messageId && 'messages' in channel) {
      const edited = await (channel as any).messages.edit(messageId, { ...card, allowedMentions: { parse: [] } }).catch(() => null);
      if (edited) return;
    }
    // Card was deleted or never stored — fall back to posting a fresh one.
    await this.postReportCard(reportId, guildId);
  }

  public async getReporterCredibility(guildId: string, userId: string): Promise<{ actioned: number; ignored: number; false: number }> {
    const [rows] = await this.app.db.query<RowDataPacket[]>(
      'SELECT actioned, ignored, marked_false FROM reporter_stats WHERE guild_id = ? AND user_id = ?',
      [guildId, userId],
    );
    const r = rows[0];
    return { actioned: r?.actioned ?? 0, ignored: r?.ignored ?? 0, false: r?.marked_false ?? 0 };
  }

  public async resolve(reportId: number, status: 'actioned' | 'ignored' | 'false', resolvedBy: string, opts?: ResolveOptions): Promise<void> {
    await this.app.db.execute(
      'UPDATE reports SET status = ?, resolved_by = ?, resolved_at = NOW(), resolved_action = ?, resolved_reason = ?, resolved_duration = ? WHERE id = ?',
      [status, resolvedBy, opts?.action ?? null, opts?.reason ?? null, opts?.duration ?? null, reportId],
    );

    await this.deleteReportCard(reportId);

    const [rows] = await this.app.db.query<RowDataPacket[]>(
      'SELECT guild_id, reporter_id FROM reports WHERE id = ?',
      [reportId],
    );
    const report = rows[0];
    if (report) {
      if (status === 'actioned') {
        await this.app.db.execute(
          'UPDATE reporter_stats SET actioned = actioned + 1 WHERE guild_id = ? AND user_id = ?',
          [report.guild_id, report.reporter_id],
        );
      } else if (status === 'ignored') {
        await this.app.db.execute(
          'UPDATE reporter_stats SET ignored = ignored + 1 WHERE guild_id = ? AND user_id = ?',
          [report.guild_id, report.reporter_id],
        );
      } else if (status === 'false' && this.app.config.reports.false_report_warning_enabled) {
        const member = await this.app.client.guilds.cache.get(report.guild_id)?.members.fetch(report.reporter_id).catch(() => null);
        if (member) {
          await this.app.punishmentManager.warn(member, {
            reason: 'False report',
            moderatorId: resolvedBy,
            silent: true,
          });
        }
      }
    }

    await this.app.logManager.log({
      event: 'report_resolved',
      guildId: report?.guild_id ?? '0',
      actorId: resolvedBy,
      targetId: report?.reporter_id,
      message: `Report #${reportId} marked as ${status}${opts?.action ? ` (${opts.action})` : ''} by <@${resolvedBy}>`,
      details: { status, action: opts?.action, reason: opts?.reason, duration: opts?.duration },
    });

    if (report) {
      await this.postArchivedCard(reportId, report.guild_id, status, resolvedBy, opts).catch(() => undefined);
    }
  }

  public async ignoreAllOpen(guildId: string, resolvedBy: string): Promise<number> {
    const [rows] = await this.app.db.query<RowDataPacket[]>(
      "SELECT id FROM reports WHERE guild_id = ? AND status = 'open' ORDER BY id ASC",
      [guildId],
    );
    for (const row of rows) {
      await this.resolve(Number(row.id), 'ignored', resolvedBy);
    }
    return rows.length;
  }

  public async countOpen(guildId: string): Promise<number> {
    const [rows] = await this.app.db.query<RowDataPacket[]>(
      "SELECT COUNT(*) AS count FROM reports WHERE guild_id = ? AND status = 'open'",
      [guildId],
    );
    return Number(rows[0]?.count ?? 0);
  }

  private async postArchivedCard(
    reportId: number,
    guildId: string,
    status: 'actioned' | 'ignored' | 'false',
    resolvedBy: string,
    opts?: ResolveOptions,
  ): Promise<void> {
    const cfg = this.app.config.reports;
    if (!cfg.archive.enabled || !cfg.archive.channel_id) return;

    const [rows] = await this.app.db.query<RowDataPacket[]>('SELECT * FROM reports WHERE id = ?', [reportId]);
    const report = rows[0];
    if (!report) return;

    const guild = this.app.client.guilds.cache.get(guildId);
    if (!guild) return;
    const channel = guild.channels.cache.get(cfg.archive.channel_id);
    if (!channel || !('send' in channel)) return;

    const attachments = parseJson(report.attachment_urls, []) as string[];
    const imageUrl = attachments.find((a) => IMAGE_RE.test(a)) ?? null;

    const targetId: string | null = report.target_user_id ? String(report.target_user_id) : null;
    let targetAvatarUrl: string | null = imageUrl;
    let targetCreatedAt: number | null = null;
    let targetJoinedAt: number | null = null;
    let targetTag: string | null = null;

    if (targetId) {
      const user = await this.app.client.users.fetch(targetId).catch(() => null);
      if (user) {
        targetAvatarUrl = user.displayAvatarURL({ size: 128, extension: 'png' });
        targetCreatedAt = Math.floor(user.createdTimestamp / 1000);
        targetTag = user.tag ?? user.username;
      }
      const member = await guild.members.fetch(targetId).catch(() => null);
      if (member?.joinedAt) {
        targetJoinedAt = Math.floor(member.joinedAt.getTime() / 1000);
      }
    }

    let lastCaseType: string | null = null;
    let lastCaseAt: number | null = null;
    if (targetId) {
      const [caseRows] = await this.app.db.query<RowDataPacket[]>(
        'SELECT type, created_at FROM cases WHERE guild_id = ? AND user_id = ? ORDER BY created_at DESC LIMIT 1',
        [guildId, targetId],
      );
      const lastCase = caseRows[0];
      if (lastCase) {
        lastCaseType = String(lastCase.type).toUpperCase();
        lastCaseAt = Math.floor(new Date(lastCase.created_at).getTime() / 1000);
      }
    }

    const reporter = await this.app.client.users.fetch(String(report.reporter_id)).catch(() => null);
    const reporterTag = reporter?.tag ?? reporter?.username ?? String(report.reporter_id);

    const resolvedByUser = await this.app.client.users.fetch(resolvedBy).catch(() => null);
    const resolvedByTag = resolvedByUser?.tag ?? resolvedByUser?.username ?? `<@${resolvedBy}>`;

    const resolvedStatus = status === 'actioned' ? 'actioned' : 'ignored';

    const card = buildReportCard({
      status: resolvedStatus,
      reportId,
      reporterCount: Number(report.reporter_count) || 1,
      targetId,
      targetTag,
      targetAvatarUrl,
      targetCreatedAt,
      targetJoinedAt,
      lastCaseType,
      lastCaseAt,
      reason: report.reason ? String(report.reason) : null,
      targetContent: report.target_content ? String(report.target_content) : null,
      sourceChannelId: report.source_channel_id ? String(report.source_channel_id) : null,
      targetMessageId: report.target_message_id ? String(report.target_message_id) : null,
      guildId,
      reporterTag,
      reporterId: String(report.reporter_id),
      resolvedBy,
      resolvedByTag,
      resolvedNote: opts?.action ?? opts?.reason ?? null,
      imageUrl,
    });

    await (channel as any).send({ ...card, allowedMentions: { parse: [] } }).catch(() => undefined);
  }


  private async deleteReportCard(reportId: number): Promise<void> {
    const cfg = this.app.config.reports;
    if (!cfg.channel_id) return;
    const [rows] = await this.app.db.query<RowDataPacket[]>(
      'SELECT guild_id, channel_message_id FROM reports WHERE id = ?',
      [reportId],
    );
    const row = rows[0];
    if (!row?.channel_message_id) return;
    const guild = this.app.client.guilds.cache.get(row.guild_id);
    if (!guild) return;
    const channel = guild.channels.cache.get(cfg.channel_id);
    if (!channel || !('messages' in channel)) return;
    await (channel as any).messages.delete(row.channel_message_id).catch(() => undefined);
  }
}
