import type { ButtonInteraction, ModalSubmitInteraction, TextBasedChannel } from 'discord.js';
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ContainerBuilder,
  MessageFlags,
  SeparatorBuilder,
  TextDisplayBuilder,
} from 'discord.js';
import type { RowDataPacket } from 'mysql2/promise';
import type { App } from '../core/context';
import { parseDuration } from '../../../shared/src/index';

const ACTIONS: Array<{ action: string; label: string; style: ButtonStyle }> = [
  { action: 'warn', label: 'Warn', style: ButtonStyle.Primary },
  { action: 'mute', label: 'Mute', style: ButtonStyle.Danger },
  { action: 'kick', label: 'Kick', style: ButtonStyle.Danger },
  { action: 'ban', label: 'Ban', style: ButtonStyle.Danger },
];

/** Build a simple v2 ephemeral reply container */
function v2Ephemeral(text: string): { components: unknown[]; flags: number } {
  const container = new ContainerBuilder()
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(text));
  return { components: [container], flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral };
}

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
    await interaction.reply(v2Ephemeral('You do not have permission to action reports.') as never);
    return false;
  }
  return true;
}

async function loadReport(app: App, reportId: number): Promise<RowDataPacket | null> {
  const [rows] = await app.db.query<RowDataPacket[]>('SELECT * FROM reports WHERE id = ?', [reportId]);
  return rows[0] ?? null;
}

// Take action
const action = {
  type: 'button',
  id: 'report:action:',
  async run(app: App, interaction: ButtonInteraction) {
    const reportId = Number(interaction.customId.replace('report:action:', ''));
    if (!(await resolve(app, interaction, reportId))) return;

    const container = new ContainerBuilder()
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`**Choose an action for report #${reportId}:**`),
      )
      .addSeparatorComponents(new SeparatorBuilder())
      .addActionRowComponents(
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          ...ACTIONS.map((a) =>
            new ButtonBuilder()
              .setCustomId(`report:pick:${a.action}:${reportId}`)
              .setLabel(a.label)
              .setStyle(a.style),
          ),
        ) as never,
      );

    await interaction.reply({
      components: [container],
      flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
    } as never);
  },
};

// Pick action
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
      await interaction.reply(v2Ephemeral('Report not found.') as never);
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

// Modal submit
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
      await interaction.reply(v2Ephemeral('Report not found.') as never);
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
      await interaction.reply(v2Ephemeral(`✅ Report #${reportId} actioned — **${actionName}** applied.`) as never);
    } else {
      await interaction.reply(v2Ephemeral(`❌ Failed to ${actionName}: ${errMsg}`) as never);
    }
  },
};

// Ignore
const ignore = {
  type: 'button',
  id: 'report:ignore:',
  async run(app: App, interaction: ButtonInteraction) {
    const reportId = Number(interaction.customId.replace('report:ignore:', ''));
    if (!(await resolve(app, interaction, reportId))) return;
    await app.reporting.resolve(reportId, 'ignored', interaction.user.id);
    await interaction.reply(v2Ephemeral(`Report #${reportId} ignored.`) as never);
  },
};

// False report
const falseReport = {
  type: 'button',
  id: 'report:false:',
  async run(app: App, interaction: ButtonInteraction) {
    const reportId = Number(interaction.customId.replace('report:false:', ''));
    if (!(await resolve(app, interaction, reportId))) return;
    await app.reporting.resolve(reportId, 'false', interaction.user.id);
    await interaction.reply(v2Ephemeral(`Report #${reportId} marked as a false report.`) as never);
  },
};

// User info
const userinfo = {
  type: 'button',
  id: 'report:userinfo:',
  async run(app: App, interaction: ButtonInteraction) {
    const reportId = Number(interaction.customId.replace('report:userinfo:', ''));
    if (!(await resolve(app, interaction, reportId))) return;
    const report = await loadReport(app, reportId);
    if (!report) {
      await interaction.reply(v2Ephemeral('Report not found.') as never);
      return;
    }
    const targetId = report.target_user_id ? String(report.target_user_id) : null;
    if (!targetId) {
      await interaction.reply(v2Ephemeral('No target user on this report.') as never);
      return;
    }
    const guild = interaction.guild;
    const user = await app.client.users.fetch(targetId).catch(() => null);
    const member = guild ? await guild.members.fetch(targetId).catch(() => null) : null;

    const [casesRes, warningsRes, riskRes] = await Promise.all([
      app.db.query<RowDataPacket[]>(
        'SELECT type, created_at FROM cases WHERE guild_id = ? AND user_id = ? ORDER BY created_at DESC LIMIT 5',
        [guild?.id ?? '0', targetId],
      ),
      app.db.query<RowDataPacket[]>(
        'SELECT COUNT(*) AS count FROM warnings WHERE guild_id = ? AND user_id = ? AND active = 1',
        [guild?.id ?? '0', targetId],
      ),
      app.db.query<RowDataPacket[]>(
        'SELECT score FROM risk_scores WHERE guild_id = ? AND user_id = ?',
        [guild?.id ?? '0', targetId],
      ),
    ]);

    const cases = casesRes[0] as Array<{ type: string; created_at: Date }>;
    const warnCount = Number(warningsRes[0][0]?.count ?? 0);
    const riskScore = riskRes[0][0]?.score ?? 0;

    const lines: string[] = [
      `**User info — ${user?.tag ?? targetId}**`,
      `ID: \`${targetId}\``,
    ];
    if (user) lines.push(`Account created: <t:${Math.floor(user.createdTimestamp / 1000)}:R>`);
    if (member?.joinedAt) lines.push(`Joined server: <t:${Math.floor(member.joinedAt.getTime() / 1000)}:R>`);
    lines.push(`Active warnings: **${warnCount}** | Risk score: **${riskScore}**`);
    if (cases.length > 0) {
      lines.push('');
      lines.push('**Recent cases**');
      lines.push(cases.map((c) => `- ${String(c.type).toUpperCase()} — <t:${Math.floor(new Date(c.created_at).getTime() / 1000)}:R>`).join('\n'));
    } else {
      lines.push('No cases on record.');
    }

    const container = new ContainerBuilder()
      .addTextDisplayComponents(new TextDisplayBuilder().setContent(lines.join('\n')));

    await interaction.reply({
      components: [container],
      flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
    } as never);
  },
};

// Archive messages
const archive = {
  type: 'button',
  id: 'report:archive:',
  async run(app: App, interaction: ButtonInteraction) {
    const reportId = Number(interaction.customId.replace('report:archive:', ''));
    if (!(await resolve(app, interaction, reportId))) return;
    const report = await loadReport(app, reportId);
    if (!report) {
      await interaction.reply(v2Ephemeral('Report not found.') as never);
      return;
    }

    await interaction.deferReply({ ephemeral: true } as never);

    const guild = interaction.guild;
    if (!guild) return;

    const sourceChannelId: string | null = report.source_channel_id ? String(report.source_channel_id) : null;
    const targetUserId: string | null = report.target_user_id ? String(report.target_user_id) : null;
    const channel = sourceChannelId
      ? (guild.channels.cache.get(sourceChannelId) as TextBasedChannel | undefined)
      : undefined;

    if (!channel || !('messages' in channel)) {
      await interaction.editReply(v2Ephemeral('Source channel not found or cannot be archived.') as never);
      return;
    }

    const amount = app.config.archives.default_amount;
    const result = await app.archives.archiveChannel({
      guild,
      channel,
      amount,
      userId: targetUserId,
      createdBy: interaction.user.id,
      kind: 'case_evidence',
      reason: `Report #${reportId}`,
    });

    if (!result) {
      await interaction.editReply(v2Ephemeral('No messages found to archive.') as never);
      return;
    }

    const container = new ContainerBuilder()
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          `✅ **Archived ${result.messageCount} message(s)** from <#${sourceChannelId}>\n${result.link}`,
        ),
      );

    await interaction.editReply({
      components: [container],
      flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
    } as never);
  },
};

export default [action, pick, modal, ignore, falseReport, userinfo, archive];
