import { SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction, Message } from 'discord.js';
import type { Guild, GuildMember } from 'discord.js';
import type { RowDataPacket } from 'mysql2/promise';
import type { App } from '../../core/context';
import type { BotCommand } from '../../types/command';
import { v2Reply, v2MessageReply } from '../../utils/v2';

const data = new SlashCommandBuilder()
  .setName('caseclose')
  .setDescription('Close case(s) and revert the punishment (one or multiple, comma-separated)')
  .addStringOption((o) => o.setName('cases').setDescription('Case code(s) or number(s), comma-separated').setRequired(true));

async function resolveCase(app: App, guildId: string, id: string): Promise<RowDataPacket | null> {
  const trimmed = id.trim();
  if (/^\d+$/.test(trimmed)) {
    return await app.caseService.getCaseByNumber(guildId, parseInt(trimmed, 10));
  }
  return await app.caseService.getCaseByCode(guildId, trimmed);
}

async function revertPunishment(app: App, guild: Guild, c: RowDataPacket, pun: RowDataPacket | null, actorId: string): Promise<string[]> {
  const reverted: string[] = [];
  const type = String(c.type);
  const userId = String(c.user_id);

  if (type === 'mute' || type === 'timeout') {
    const member: GuildMember | null = await guild.members.fetch(userId).catch(() => null);
    if (member) {
      const r = await app.punishmentManager.unmute(member, {
        reason: `Case ${c.case_code} closed`,
        moderatorId: actorId,
      });
      if (r.ok) reverted.push('unmute');
    }
  } else if (type === 'ban' || type === 'tempban') {
    const r = await app.punishmentManager.unban(guild, userId, {
      reason: `Case ${c.case_code} closed`,
      moderatorId: actorId,
    });
    if (r.ok) reverted.push('unban');
  } else if (type === 'warn') {
    await app.caseService.deactivateWarning(Number(c.id));
    await app.logManager.log({
      event: 'member_unwarn',
      guildId: guild.id,
      actorId,
      targetId: userId,
      message: `Warning removed for <@${userId}> (case ${c.case_code} closed)`,
      details: { caseCode: c.case_code },
    });
    reverted.push('warn');
  } else if (type === 'temp_role' && pun?.role_id) {
    const member: GuildMember | null = await guild.members.fetch(userId).catch(() => null);
    if (member) {
      await member.roles.remove(String(pun.role_id), `Case ${c.case_code} closed`).catch(() => undefined);
      reverted.push('temp role');
    }
  }

  // Notify the user their punishment was removed (configurable via
  // punishment_dms.types.case_closed).
  if (reverted.length > 0) {
    const user = await app.client.users.fetch(userId).catch(() => null);
    if (user) {
      const moderator =
        (await guild.members.fetch(actorId).catch(() => null))?.displayName ?? undefined;
      await app.punishmentDm
        .send('case_closed', {
          guild,
          user,
          reason: `case ${c.case_code} closed`,
          moderator,
          caseCode: String(c.case_code),
        })
        .catch(() => undefined);
    }
  }
  return reverted;
}

async function closeOne(app: App, guild: Guild, actorId: string, caseId: number): Promise<{ ok: boolean; error?: string; code?: string; reverted: string[] }> {
  const [rows] = await app.db.query<RowDataPacket[]>('SELECT * FROM cases WHERE id = ?', [caseId]);
  const c = rows[0];
  if (!c) return { ok: false, error: 'case not found', reverted: [] };
  const code = String(c.case_code);
  if (c.status === 'closed') return { ok: false, error: `#${code} is already closed`, reverted: [] };
  if (c.status === 'voided') return { ok: false, error: `#${code} is voided`, reverted: [] };

  const [pRows] = await app.db.query<RowDataPacket[]>(
    'SELECT * FROM punishments WHERE case_id = ? AND active = 1 LIMIT 1',
    [caseId],
  );
  const pun = pRows[0] ?? null;

  const reverted = await revertPunishment(app, guild, c, pun, actorId);

  if (pun) {
    await app.db.execute('UPDATE punishments SET active = 0 WHERE id = ?', [pun.id]);
  }
  await app.caseService.setStatus(caseId, 'closed');
  await app.db.execute('UPDATE warnings SET active = 0 WHERE case_id = ?', [caseId]).catch(() => undefined);

  await app.logManager.log({
    event: 'case_closed',
    guildId: guild.id,
    actorId,
    targetId: c.user_id,
    message: `Case ${code} closed${reverted.length ? ` (reverted: ${reverted.join(', ')})` : ''}`,
    details: { type: c.type, reverted },
  });

  return { ok: true, code, reverted };
}

async function closeMany(app: App, guild: Guild, actorId: string, raw: string): Promise<string[]> {
  const ids = raw.split(',').map((s) => s.trim()).filter(Boolean);
  const lines: string[] = [];
  for (const id of ids) {
    const c = await resolveCase(app, guild.id, id);
    if (!c) {
      lines.push(`\`${id}\`: not found`);
      continue;
    }
    const r = await closeOne(app, guild, actorId, Number(c.id));
    if (r.ok) {
      lines.push(`#${r.code} closed${r.reverted.length ? ` (reverted: ${r.reverted.join(', ')})` : ''}`);
    } else {
      lines.push(r.error!);
    }
  }
  return lines;
}

async function execute(interaction: ChatInputCommandInteraction, app: App): Promise<void> {
  await interaction.deferReply();
  const guild = interaction.guild;
  if (!guild) return;
  const raw = interaction.options.getString('cases', true);
  const lines = await closeMany(app, guild, interaction.user.id, raw);
  await v2Reply(interaction, `**Close case(s)**\n${lines.join('\n')}`);
}

async function prefixExecute(message: Message, args: string[], app: App): Promise<void> {
  const guild = message.guild;
  const raw = args[0] ?? '';
  if (!guild || !raw) {
    await v2MessageReply(message, { content: 'Usage: `!caseclose <case code or number>` (multiple: comma-separated)' });
    return;
  }
  const lines = await closeMany(app, guild, message.author.id, raw);
  await v2MessageReply(message, { content: `**Close case(s)**\n${lines.join('\n')}` });
}

const command: BotCommand = {
  name: 'caseclose',
  category: 'moderation',
  description: 'Close case(s) and revert the punishment',
  data,
  permissions: ['ModerateMembers'],
  aliases: ['closecase', 'close'],
  execute,
  prefixExecute,
};

export default command;
