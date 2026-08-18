"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReportingService = void 0;
const v2_1 = require("../utils/v2");
class ReportingService {
    app;
    constructor(app) {
        this.app = app;
    }
    async createReport(input) {
        const cfg = this.app.config.reports;
        if (!cfg.enabled)
            return { id: 0, merged: false };
        const existing = await this.findDuplicate(input);
        if (existing) {
            await this.app.db.execute('UPDATE reports SET reporter_count = reporter_count + 1 WHERE id = ?', [existing.id]);
            await this.postReportCard(existing.id, input.guildId);
            return { id: existing.id, merged: true };
        }
        const [result] = await this.app.db.execute(`INSERT INTO reports (guild_id, reporter_id, target_user_id, target_message_id, reason)
       VALUES (?, ?, ?, ?, ?)`, [input.guildId, input.reporterId, input.targetUserId ?? null, input.targetMessageId ?? null, input.reason ?? null]);
        const id = result.insertId;
        await this.postReportCard(id, input.guildId);
        await this.app.db.execute(`INSERT INTO reporter_stats (guild_id, user_id) VALUES (?, ?)
       ON DUPLICATE KEY UPDATE user_id = VALUES(user_id)`, [input.guildId, input.reporterId]);
        await this.app.logManager.log({
            event: 'report_created',
            guildId: input.guildId,
            actorId: input.reporterId,
            targetId: input.targetUserId,
            message: `Report #${id} created by <@${input.reporterId}>`,
            details: { reason: input.reason },
        });
        return { id, merged: false };
    }
    async findDuplicate(input) {
        const cfg = this.app.config.reports;
        const [rows] = await this.app.db.query(`SELECT id FROM reports
       WHERE guild_id = ? AND status = 'open'
         AND created_at > DATE_SUB(NOW(), INTERVAL ? SECOND)
         AND (
           (target_message_id IS NOT NULL AND target_message_id = ?) OR
           (target_user_id IS NOT NULL AND target_user_id = ?)
         )
       LIMIT 1`, [input.guildId, cfg.merge_window_seconds, input.targetMessageId ?? null, input.targetUserId ?? null]);
        return rows[0] ?? null;
    }
    async postReportCard(reportId, guildId) {
        const app = this.app;
        const cfg = app.config.reports;
        const [rows] = await app.db.query('SELECT * FROM reports WHERE id = ?', [reportId]);
        const report = rows[0];
        if (!report)
            return;
        const guild = app.client.guilds.cache.get(guildId);
        if (!guild)
            return;
        const channel = cfg.channel_id && guild.channels.cache.get(cfg.channel_id);
        if (!channel || !('send' in channel))
            return;
        const credibility = await this.getReporterCredibility(guildId, report.reporter_id);
        const target = report.target_user_id ? `<@${report.target_user_id}>` : 'unknown';
        const messageRef = report.target_message_id
            ? `https://discord.com/channels/${guildId}/${'id' in channel ? channel.id : ''}/${report.target_message_id}`
            : '';
        const text = [
            `Report #${report.id} — reported by N users: ${report.reporter_count}`,
            `Reporter: <@${report.reporter_id}> (credibility: ${credibility.actioned} actioned / ${credibility.ignored} ignored / ${credibility.false} false)`,
            `Target: ${target}`,
            report.reason ? `Reason: ${report.reason}` : '',
            messageRef ? `Message: ${messageRef}` : '',
        ].filter(Boolean).join('\n');
        await (0, v2_1.v2Send)(channel, text, {
            buttons: [
                { customId: `report:action:${reportId}`, label: 'Action', style: 4 },
                { customId: `report:ignore:${reportId}`, label: 'Ignore', style: 2 },
            ],
            accentColor: '#ED4245',
        }).catch(() => undefined);
    }
    async getReporterCredibility(guildId, userId) {
        const [rows] = await this.app.db.query('SELECT actioned, ignored, marked_false FROM reporter_stats WHERE guild_id = ? AND user_id = ?', [guildId, userId]);
        const r = rows[0];
        return { actioned: r?.actioned ?? 0, ignored: r?.ignored ?? 0, false: r?.marked_false ?? 0 };
    }
    async resolve(reportId, status, resolvedBy) {
        await this.app.db.execute('UPDATE reports SET status = ?, resolved_by = ?, resolved_at = NOW() WHERE id = ?', [
            status,
            resolvedBy,
            reportId,
        ]);
        const [rows] = await this.app.db.query('SELECT guild_id, reporter_id FROM reports WHERE id = ?', [reportId]);
        const report = rows[0];
        if (report) {
            if (status === 'actioned') {
                await this.app.db.execute('UPDATE reporter_stats SET actioned = actioned + 1 WHERE guild_id = ? AND user_id = ?', [report.guild_id, report.reporter_id]);
            }
            else if (status === 'ignored') {
                await this.app.db.execute('UPDATE reporter_stats SET ignored = ignored + 1 WHERE guild_id = ? AND user_id = ?', [report.guild_id, report.reporter_id]);
            }
            else if (status === 'false' && this.app.config.reports.false_report_warning_enabled) {
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
        await this.archive(reportId);
    }
    async archive(reportId) {
        const cfg = this.app.config.reports;
        if (!cfg.archive.enabled || !cfg.archive.channel_id)
            return;
        const [rows] = await this.app.db.query('SELECT * FROM reports WHERE id = ?', [reportId]);
        const report = rows[0];
        if (!report)
            return;
        const guild = this.app.client.guilds.cache.get(report.guild_id);
        const channel = guild?.channels.cache.get(cfg.archive.channel_id);
        if (!channel || !('send' in channel))
            return;
        await channel.send({
            content: [
                `Archived Report #${reportId} — ${report.status}`,
                `Reporter: <@${report.reporter_id}>`,
                `Target: ${report.target_user_id ? `<@${report.target_user_id}>` : 'unknown'}`,
                report.reason ? `Reason: ${report.reason}` : '',
                `Reports merged: ${report.reporter_count}`,
            ].filter(Boolean).join('\n'),
        }).catch(() => undefined);
    }
}
exports.ReportingService = ReportingService;
//# sourceMappingURL=reportingService.js.map