import { SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction, Message } from 'discord.js';
import type { App } from '../../core/context';
import type { BotCommand } from '../../types/command';
import { v2Reply } from '../../utils/v2';
import { v2MessageReply } from '../../utils/v2';
import { formatEvidenceLines } from '../../utils/evidence';
import { humanizeDuration, parseJson } from '../../../../shared/src/index';

const data = new SlashCommandBuilder()
  .setName('case')
  .setDescription('View or manage a case')
  .addSubcommand((s) => s.setName('view').setDescription('View a case').addStringOption((o) => o.setName('id').setDescription('Case code or number').setRequired(true)))
  .addSubcommand((s) => s.setName('edit').setDescription('Edit a case reason').addStringOption((o) => o.setName('id').setDescription('Case code or number').setRequired(true)).addStringOption((o) => o.setName('reason').setDescription('New reason').setRequired(true)))
  .addSubcommand((s) => s.setName('void').setDescription('Void a case').addStringOption((o) => o.setName('id').setDescription('Case code or number').setRequired(true)).addStringOption((o) => o.setName('reason').setDescription('Why voiding').setRequired(false)))
  .addSubcommand((s) => s.setName('link').setDescription('Link two cases').addStringOption((o) => o.setName('id').setDescription('Case code or number').setRequired(true)).addStringOption((o) => o.setName('other').setDescription('Other case code or number').setRequired(true)))
  .addSubcommand((s) => s.setName('bulk_edit').setDescription('Edit reason on multiple cases').addStringOption((o) => o.setName('ids').setDescription('Comma-separated codes/numbers').setRequired(true)).addStringOption((o) => o.setName('reason').setDescription('New reason').setRequired(true)));

async function resolveCase(app: App, guildId: string, id: string): Promise<{ c: any } | null> {
  const trimmed = id.trim();
  if (/^\d+$/.test(trimmed)) {
    const c = await app.caseService.getCaseByNumber(guildId, parseInt(trimmed, 10));
    return c ? { c } : null;
  }
  const c = await app.caseService.getCaseByCode(guildId, trimmed);
  return c ? { c } : null;
}

function relTime(date: Date | string | null | undefined): string | null {
  if (!date) return null;
  const ts = Math.floor(new Date(date).getTime() / 1000);
  return Number.isFinite(ts) ? `<t:${ts}:R>` : null;
}

async function caseViewLines(app: App, guildId: string, c: any): Promise<string> {
  const created = relTime(c.created_at);
  const updated = relTime(c.updated_at);

  const lines: string[] = [
    `**Case ${c.case_code}** (#${c.case_number}) — ${String(c.status).toUpperCase()}`,
    `Type: ${String(c.type).toUpperCase()}`,
    `User: <@${c.user_id}> (\`${c.user_id}\`)`,
    `Moderator: ${c.moderator_id ? `<@${c.moderator_id}>` : 'system'}`,
    `Reason: ${c.reason}`,
  ];
  if (c.duration_ms) lines.push(`Duration: ${humanizeDuration(Number(c.duration_ms))}`);
  if (created) lines.push(`Created: ${created}`);
  if (updated && updated !== created) lines.push(`Last updated: ${updated}`);

  const evidenceRaw = typeof c.evidence === 'string' ? parseJson(c.evidence, null) : c.evidence;
  const evidence = formatEvidenceLines(evidenceRaw, guildId);
  if (evidence) {
    lines.push('', '**Evidence**');
    lines.push(...evidence.split('\n').map((l) => `> ${l}`));
  }

  const linkedIdsRaw = typeof c.linked_case_ids === 'string' ? parseJson(c.linked_case_ids, []) : c.linked_case_ids;
  const linkedIds: number[] = Array.isArray(linkedIdsRaw) ? linkedIdsRaw : [];
  if (linkedIds.length > 0) {
    const codes: string[] = [];
    for (const id of linkedIds) {
      const linked = await app.caseService.getCaseById(id).catch(() => null);
      if (linked) codes.push(linked.case_code);
    }
    if (codes.length > 0) lines.push('', `**Linked cases:** ${codes.join(', ')}`);
  }

  const warnCount = await app.caseService.countWarnings(guildId, c.user_id);
  lines.push('', `Active warnings for user: **${warnCount}**`);

  return lines.join('\n');
}

async function execute(interaction: ChatInputCommandInteraction, app: App): Promise<void> {
  await interaction.deferReply();
  const guild = interaction.guild;
  if (!guild) return;
  const sub = interaction.options.getSubcommand();

  if (sub === 'view') {
    const found = await resolveCase(app, guild.id, interaction.options.getString('id', true));
    if (!found) {
      await v2Reply(interaction, 'Case not found.', { ephemeral: true });
      return;
    }
    await v2Reply(interaction, await caseViewLines(app, guild.id, found.c));
  } else if (sub === 'edit') {
    const found = await resolveCase(app, guild.id, interaction.options.getString('id', true));
    const reason = interaction.options.getString('reason', true);
    if (!found) {
      await v2Reply(interaction, 'Case not found.', { ephemeral: true });
      return;
    }
    await app.caseService.updateReason(found.c.id, reason);
    await app.logManager.log({ event: 'case_edit', guildId: guild.id, actorId: interaction.user.id, targetId: found.c.user_id, message: `Case ${found.c.case_code} reason edited`, details: { newReason: reason } });
    await v2Reply(interaction, `Case ${found.c.case_code} updated.`);
  } else if (sub === 'void') {
    const found = await resolveCase(app, guild.id, interaction.options.getString('id', true));
    const reason = interaction.options.getString('reason');
    if (!found) {
      await v2Reply(interaction, 'Case not found.', { ephemeral: true });
      return;
    }
    await app.caseService.voidCase(found.c.id, reason ?? undefined);
    if (found.c.type === 'warn') await app.caseService.deactivateWarning(found.c.id);
    await v2Reply(interaction, `Case ${found.c.case_code} voided.`);
  } else if (sub === 'link') {
    const a = await resolveCase(app, guild.id, interaction.options.getString('id', true));
    const b = await resolveCase(app, guild.id, interaction.options.getString('other', true));
    if (!a || !b) {
      await v2Reply(interaction, 'One or both cases not found.', { ephemeral: true });
      return;
    }
    await app.caseService.linkCases(guild.id, a.c.id, [b.c.id]);
    await v2Reply(interaction, `Linked case ${a.c.case_code} and ${b.c.case_code}.`);
  } else if (sub === 'bulk_edit') {
    const ids = interaction.options.getString('ids', true).split(',').map((s) => s.trim()).filter(Boolean);
    const reason = interaction.options.getString('reason', true);
    const resolved = [];
    for (const id of ids) {
      const found = await resolveCase(app, guild.id, id);
      if (found) resolved.push(found.c.id);
    }
    await app.caseService.bulkUpdateReason(resolved, reason);
    await v2Reply(interaction, `Updated ${resolved.length} case(s).`);
  }
}

async function prefixExecute(message: Message, args: string[], app: App): Promise<void> {
  const guild = message.guild;
  if (!guild) return;
  const sub = args[0] ?? 'view';
  const id = args[1];
  if (sub === 'view' && id) {
    const found = await resolveCase(app, guild.id, id);
    await v2MessageReply(message, { content: found ? await caseViewLines(app, guild.id, found.c) : 'Case not found.' });
    return;
  }
  if (sub === 'edit' && id && args[2]) {
    const found = await resolveCase(app, guild.id, id);
    const reason = args.slice(2).join(' ');
    if (!found) {
      await v2MessageReply(message, { content: 'Case not found.' });
      return;
    }
    await app.caseService.updateReason(found.c.id, reason);
    await app.logManager.log({ event: 'case_edit', guildId: guild.id, actorId: message.author.id, targetId: found.c.user_id, message: `Case ${found.c.case_code} reason edited`, details: { newReason: reason } });
    await v2MessageReply(message, { content: `Case ${found.c.case_code} updated.` });
    return;
  }
  if (sub === 'void' && id) {
    const found = await resolveCase(app, guild.id, id);
    const reason = args.slice(2).join(' ') || undefined;
    if (!found) {
      await v2MessageReply(message, { content: 'Case not found.' });
      return;
    }
    await app.caseService.voidCase(found.c.id, reason);
    if (found.c.type === 'warn') await app.caseService.deactivateWarning(found.c.id);
    await v2MessageReply(message, { content: `Case ${found.c.case_code} voided.` });
    return;
  }
  if (sub === 'link' && id && args[2]) {
    const a = await resolveCase(app, guild.id, id);
    const b = await resolveCase(app, guild.id, args[2]);
    if (!a || !b) {
      await v2MessageReply(message, { content: 'One or both cases not found.' });
      return;
    }
    await app.caseService.linkCases(guild.id, a.c.id, [b.c.id]);
    await v2MessageReply(message, { content: `Linked case ${a.c.case_code} and ${b.c.case_code}.` });
    return;
  }
  if (sub === 'bulk_edit' && id) {
    const reason = args.slice(2).join(' ');
    if (!reason) {
      await v2MessageReply(message, { content: 'Usage: `!case bulk_edit <ids> <reason>`' });
      return;
    }
    const ids = id.split(',').map((s) => s.trim()).filter(Boolean);
    const resolved = [];
    for (const cid of ids) {
      const found = await resolveCase(app, guild.id, cid);
      if (found) resolved.push(found.c.id);
    }
    await app.caseService.bulkUpdateReason(resolved, reason);
    await v2MessageReply(message, { content: `Updated ${resolved.length} case(s).` });
    return;
  }
  await v2MessageReply(message, { content: 'Usage: `!case view <code>` | `!case edit <code> <reason>` | `!case void <code>` | `!case link <code> <code>` | `!case bulk_edit <ids> <reason>`' });
}

const command: BotCommand = {
  name: 'case',
  category: 'moderation',
  description: 'View or manage a case',
  data,
  permissions: ['ModerateMembers'],
  aliases: ['c'],
  execute,
  prefixExecute,
};

export default command;