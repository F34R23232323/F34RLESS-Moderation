import type { RowDataPacket } from 'mysql2/promise';
import type { App } from '../core/context';
import { v2Send } from '../utils/v2';
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
      await this.app.db.execute('UPDATE reports SET reporter_count = reporter_count + 1 WHERE id = ?', [existing.id]);
      await this.postReportCard(existing.id, input.guildId);
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

  private async postReportCard(reportId: number, guildId: string): Promise<void> {
    const app = this.app;
    const cfg = app.config.reports;
    const [rows] = await app.db.query<RowDataPacket[]>(
      'SELECT * FROM reports WHERE id = ?',
      [reportId],
    );
    const report = rows[0];
    if (!report) return;
    const guild = app.client.guilds.cache.get(guildId);
    if (!guild) return;
    const channel = cfg.channel_id && guild.channels.cache.get(cfg.channel_id);
    if (!channel || !('send' in channel)) return;

    const credibility = await this.getReporterCredibility(guildId, report.reporter_id);
    const target = report.target_user_id ? `<@${report.target_user_id}>` : 'unknown';
    const attachments = parseJson(report.attachment_urls, []) as string[];
    const pingRoleId = (cfg as { ping_role_id?: string }).ping_role_id;

    const lines: string[] = [
      `**Report #${report.id}** — ${report.reporter_count} reporter(s)`,
      `Target: ${target}`,
      `Reporter: <@${report.reporter_id}> (${credibility.actioned} actioned / ${credibility.ignored} ignored / ${credibility.false} false)`,
    ];
    if (report.reason) lines.push(`Reason: ${report.reason}`);
    if (report.source_channel_id) lines.push(`Channel: <#${report.source_channel_id}>`);
    if (report.source_module) {
      lines.push(`Module: ${report.source_module}${report.source_rule ? ` — ${report.source_rule}` : ''}`);
    }
    if (report.target_content) lines.push(`Content: ${String(report.target_content).slice(0, 1000)}`);
    if (attachments.length > 0) {
      lines.push(`Attachments (${attachments.length}): ${attachments.map((a) => a.slice(0, 150)).join('\n')}`);
    }
    lines.push(`Reported: <t:${Math.floor(new Date(report.created_at).getTime() / 1000)}:R>`);

    const preview = attachments.find((a) => IMAGE_RE.test(a));

    await v2Send(channel as never, lines.join('\n'), {
      accentColor: '#ED4245',
      imageUrl: preview,
      buttons: [
        { customId: `report:action:${report.id}`, label: 'Action', style: 4 },
        { customId: `report:ignore:${report.id}`, label: 'Ignore', style: 2 },
      ],
      allowedMentions: pingRoleId ? { parse: [], roles: [pingRoleId] } : { parse: [] },
    }).then(async (sent: any) => {
      if (sent?.id) {
        await app.db.execute('UPDATE reports SET channel_message_id = ? WHERE id = ?', [sent.id, reportId]);
      }
    }).catch(() => undefined);
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

    await this.archive(reportId);
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
    await channel.messages.delete(row.channel_message_id).catch(() => undefined);
  }

  private async archive(reportId: number): Promise<void> {
    const cfg = this.app.config.reports;
    if (!cfg.archive.enabled || !cfg.archive.channel_id) return;
    const [rows] = await this.app.db.query<RowDataPacket[]>(
      'SELECT * FROM reports WHERE id = ?',
      [reportId],
    );
    const report = rows[0];
    if (!report) return;
    const guild = this.app.client.guilds.cache.get(report.guild_id);
    const channel = guild?.channels.cache.get(cfg.archive.channel_id);
    if (!channel || !('send' in channel)) return;
    const lines = [
      `**Archived Report #${reportId}** — ${report.status}${report.resolved_action ? ` (${report.resolved_action})` : ''}`,
      `Reporter: <@${report.reporter_id}>`,
      `Target: ${report.target_user_id ? `<@${report.target_user_id}>` : 'unknown'}`,
      report.reason ? `Reason: ${report.reason}` : '',
      report.source_channel_id ? `Channel: <#${report.source_channel_id}>` : '',
      report.source_module ? `Module: ${report.source_module}${report.source_rule ? ` — ${report.source_rule}` : ''}` : '',
      report.target_content ? `Content: ${String(report.target_content).slice(0, 1000)}` : '',
      report.resolved_reason ? `Resolved reason: ${report.resolved_reason}` : '',
      report.resolved_duration ? `Duration: ${report.resolved_duration}` : '',
      report.resolved_by ? `Resolved by: <@${report.resolved_by}>` : '',
      `Reports merged: ${report.reporter_count}`,
      report.created_at ? `Reported: <t:${Math.floor(new Date(report.created_at).getTime() / 1000)}:R>` : '',
    ].filter(Boolean).join('\n');
    await channel.send({ content: lines, allowedMentions: { parse: [], repliedUser: false } }).catch(() => undefined);
  }
}
