import type { ButtonInteraction, ModalSubmitInteraction } from 'discord.js';
import type { RowDataPacket } from 'mysql2/promise';
import type { App } from '../core/context';
import { parseDuration } from '../../../shared/src/index';

const ACTIONS: Array<{ action: string; label: string; style: number }> = [
  { action: 'warn', label: 'Warn', style: 1 },
  { action: 'mute', label: 'Mute', style: 4 },
  { action: 'kick', label: 'Kick', style: 4 },
  { action: 'ban', label: 'Ban', style: 4 },
];

async function resolve(app: App, interaction: ButtonInteraction | ModalSubmitInteraction, reportId: number) {
  const guild = interaction.guild;
  const cfg = app.config.reports;
  if (!guild) return false;
  const member = interaction.member as { permissions?: { has: (p: string) => boolean }; roles?: { cache: { some: (f: (r: { id: string }) => boolean) => boolean } } } | null;
  if (!member) return false;
  const allowed =
    (member.permissions?.has('ModerateMembers') ?? false) ||
    (cfg.action_roles.length > 0 && (member.roles?.cache.some((r) => cfg.action_roles.includes(r.id)) ?? false));
  if (!allowed) {
    await interaction.reply({ content: 'You do not have permission to action reports.', ephemeral: true });
    return false;
  }
  return true;
}

async function loadReport(app: App, reportId: number): Promise<RowDataPacket | null> {
  const [rows] = await app.db.query<RowDataPacket[]>('SELECT * FROM reports WHERE id = ?', [reportId]);
  return rows[0] ?? null;
}

const action = {
  type: 'button',
  id: 'report:action:',
  async run(app: App, interaction: ButtonInteraction) {
    const reportId = Number(interaction.customId.replace('report:action:', ''));
    if (!(await resolve(app, interaction, reportId))) return;
    await interaction.reply({
      content: `Choose an action for report #${reportId}:`,
      components: [
        {
          type: 1,
          components: ACTIONS.map((a) => ({
            type: 2,
            custom_id: `report:pick:${a.action}:${reportId}`,
            label: a.label,
            style: a.style,
          })),
        },
      ],
      ephemeral: true,
    });
  },
};

const pick = {
  type: 'button',
  id: 'report:pick:',
  async run(app: App, interaction: ButtonInteraction) {
    const parts = interaction.customId.replace('report:pick:', '').split(':');
    const actionName = parts[0];
    const reportId = Number(parts[1]);
    if (!(await resolve(app, interaction, reportId))) return;
    const report = await loadReport(app, reportId);
    if (!report) {
      await interaction.reply({ content: 'Report not found.', ephemeral: true });
      return;
    }
    const components: Array<{ type: number; components: Array<Record<string, unknown>> }> = [
      {
        type: 1,
        components: [
          {
            type: 4,
            custom_id: 'reason',
            label: 'Reason',
            style: 1,
            min_length: 1,
            max_length: 1000,
            required: true,
            value: report.reason ? String(report.reason).slice(0, 1000) : '',
          },
        ],
      },
    ];
    if (actionName === 'mute' || actionName === 'ban') {
      components.push({
        type: 1,
        components: [
          {
            type: 4,
            custom_id: 'duration',
            label: actionName === 'mute' ? 'Duration (e.g. 1h)' : 'Duration (e.g. 7d, empty = permanent)',
            style: 1,
            min_length: 0,
            max_length: 32,
            required: false,
            value: actionName === 'mute' ? '1h' : '',
          },
        ],
      });
    }
    await interaction.showModal({
      customId: `report:modal:${actionName}:${reportId}`,
      title: `Report #${reportId} — ${actionName}`,
      components: components as never,
    });
  },
};

const modal = {
  type: 'modal',
  id: 'report:modal:',
  async run(app: App, interaction: ModalSubmitInteraction) {
    const parts = interaction.customId.replace('report:modal:', '').split(':');
    const actionName = parts[0];
    const reportId = Number(parts[1]);
    if (!(await resolve(app, interaction, reportId))) return;
    const reason = interaction.fields.getTextInputValue('reason') || 'Report action';
    let durationStr: string | undefined;
    try {
      durationStr = interaction.fields.getTextInputValue('duration')?.trim() || undefined;
    } catch {
      durationStr = undefined;
    }
    const report = await loadReport(app, reportId);
    if (!report) {
      await interaction.reply({ content: 'Report not found.', ephemeral: true });
      return;
    }
    const guild = interaction.guild;
    if (!guild) return;
    const targetId = String(report.target_user_id);
    const member = targetId ? await guild.members.fetch(targetId).catch(() => null) : null;

    let ok = false;
    let errMsg = '';
    try {
      if (actionName === 'warn') {
        const r = await app.punishmentManager.warn(member ?? (await app.client.users.fetch(targetId)), { reason, moderatorId: interaction.user.id, silent: true });
        ok = r.ok;
        errMsg = r.error ?? '';
      } else if (actionName === 'mute') {
        const ms = parseDuration(durationStr ?? '1h')?.milliseconds ?? 3600000;
        if (!member) {
          ok = false;
          errMsg = 'member is not in the server';
        } else {
          const r = await app.punishmentManager.timeout(member, ms, { reason, moderatorId: interaction.user.id, silent: true });
          ok = r.ok;
          errMsg = r.error ?? '';
        }
      } else if (actionName === 'kick') {
        if (!member) {
          ok = false;
          errMsg = 'member is not in the server';
        } else {
          const r = await app.punishmentManager.kick(member, { reason, moderatorId: interaction.user.id, silent: true });
          ok = r.ok;
          errMsg = r.error ?? '';
        }
      } else if (actionName === 'ban') {
        const durationMs = durationStr ? (parseDuration(durationStr)?.milliseconds ?? 0) || undefined : undefined;
        const r = await app.punishmentManager.ban(targetId as never, { reason, moderatorId: interaction.user.id, durationMs, silent: true });
        ok = r.ok;
        errMsg = r.error ?? '';
      } else {
        ok = false;
        errMsg = `unknown action "${actionName}"`;
      }
    } catch (err) {
      ok = false;
      errMsg = (err as Error).message;
    }

    if (ok) {
      await app.reporting.resolve(reportId, 'actioned', interaction.user.id, { action: actionName, reason, duration: durationStr });
      await interaction.reply({ content: `Report #${reportId} actioned — ${actionName} applied.`, ephemeral: true });
    } else {
      await interaction.reply({ content: `Failed to ${actionName}: ${errMsg}`, ephemeral: true });
    }
  },
};

const ignore = {
  type: 'button',
  id: 'report:ignore:',
  async run(app: App, interaction: ButtonInteraction) {
    const reportId = Number(interaction.customId.replace('report:ignore:', ''));
    if (!(await resolve(app, interaction, reportId))) return;
    await app.reporting.resolve(reportId, 'ignored', interaction.user.id);
    await interaction.reply({ content: `Report #${reportId} ignored — card removed.`, ephemeral: true });
  },
};

const falseReport = {
  type: 'button',
  id: 'report:false:',
  async run(app: App, interaction: ButtonInteraction) {
    const reportId = Number(interaction.customId.replace('report:false:', ''));
    if (!(await resolve(app, interaction, reportId))) return;
    await app.reporting.resolve(reportId, 'false', interaction.user.id);
    await interaction.reply({ content: `Report #${reportId} marked as a false report — card removed.`, ephemeral: true });
  },
};

export default [action, pick, modal, ignore, falseReport];
