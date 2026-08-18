import { SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction, Message } from 'discord.js';
import type { App } from '../../core/context';
import type { BotCommand } from '../../types/command';
import { v2Reply } from '../../utils/v2';

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
    const c = found.c;
    await v2Reply(interaction, [
      `**Case ${c.case_code}** (${c.status})`,
      `Type: ${c.type}`,
      `User: <@${c.user_id}>`,
      `Moderator: ${c.moderator_id ? `<@${c.moderator_id}>` : 'system'}`,
      `Reason: ${c.reason}`,
      c.duration_ms ? `Duration: ${c.duration_ms}ms` : '',
      `Created: ${new Date(c.created_at).toISOString()}`,
    ].filter(Boolean).join('\n'));
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
  if ((sub === 'view' || sub === 'void') && id) {
    const found = await resolveCase(app, guild.id, id);
    await message.reply({ content: found ? `Case ${found.c.case_code} (${found.c.status}) - ${found.c.type} - <@${found.c.user_id}> - ${found.c.reason}` : `Case not found.` });
    return;
  }
  await message.reply({ content: 'Usage: `!case view <code>` | `!case edit <code> <reason>` | `!case void <code>` | `!case link <code> <code>` | `!case bulk_edit <ids> <reason>`' });
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