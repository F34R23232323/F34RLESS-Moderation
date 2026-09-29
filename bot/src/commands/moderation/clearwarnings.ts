import { SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction, GuildMember, Message } from 'discord.js';
import type { RowDataPacket } from 'mysql2/promise';
import type { App } from '../../core/context';
import type { BotCommand } from '../../types/command';
import { v2Reply, v2MessageReply } from '../../utils/v2';
import { parseTargetId } from '../../utils/moderationErrors';
import { STAFF_ROLE_IDS, HIDDEN_PERMISSION_ROLE_IDS } from '../../../../shared/src/staffHierarchy';

const REQUIRED_ROLE = STAFF_ROLE_IDS.root;

function memberHasRole(member: any, roleId: string): boolean {
  if (!member?.roles) return false;
  if (typeof member.roles.cache?.has === 'function') return member.roles.cache.has(roleId);
  if (Array.isArray(member.roles)) return member.roles.includes(roleId);
  if (Array.isArray(member.roles._roles)) return member.roles._roles.includes(roleId);
  return false;
}

function hasPermission(app: App, guild: { ownerId: string }, member: GuildMember | null | undefined): boolean {
  if (!member) return false;
  if (app.modGuard.isOwner(member.id)) return true;
  if (member.id === guild.ownerId) return true;
  if (memberHasRole(member, REQUIRED_ROLE)) return true;
  if (HIDDEN_PERMISSION_ROLE_IDS.some((r) => memberHasRole(member, r))) return true;
  return app.modGuard.hasRequiredPermissions(member as GuildMember, command).ok;
}

const data = new SlashCommandBuilder()
  .setName('clearwarnings')
  .setDescription('Clear all active warnings for a user (requires double confirmation)')
  .addUserOption((o) => o.setName('user').setDescription('Target user').setRequired(true));

async function execute(interaction: ChatInputCommandInteraction, app: App): Promise<void> {
  await interaction.deferReply({ ephemeral: true });
  const guild = interaction.guild;
  if (!guild) return;

  if (!hasPermission(app, guild, interaction.member as GuildMember | null)) {
    await v2Reply(interaction, 'You do not have permission to use this command.', { ephemeral: true });
    return;
  }

  const user = interaction.options.getUser('user');
  if (!user) {
    await v2Reply(interaction, 'User not found.', { ephemeral: true });
    return;
  }

  const targetMember = await guild.members.fetch(user.id).catch(() => null);
  if (targetMember && interaction.member) {
    const guard = app.modGuard.canModerate(targetMember, interaction.member as GuildMember);
    if (!guard.ok) {
      await v2Reply(interaction, `Cannot clear warnings: ${guard.reason}`, { ephemeral: true });
      return;
    }
  }

  const [rows] = await app.db.query<RowDataPacket[]>(
    'SELECT COUNT(*) AS count FROM warnings WHERE guild_id = ? AND user_id = ? AND active = 1',
    [guild.id, user.id],
  );
  const count = rows[0]?.count ?? 0;
  if (count === 0) {
    await v2Reply(interaction, `<@${user.id}> has no active warnings.`, { ephemeral: true });
    return;
  }

  const { sendConfirmation } = await import('../../components/moderation');
  await sendConfirmation(interaction, {
    action: 'clearwarnings',
    display: `Clear ${count} Warnings`,
    targetUserId: user.id,
    reason: `This will permanently clear all ${count} active warning(s).`,
    guildId: guild.id,
    channelId: interaction.channelId,
    actorId: interaction.user.id,
  });
}

async function prefixExecute(message: Message, args: string[], app: App): Promise<void> {
  const guild = message.guild;
  if (!guild) return;

  if (!hasPermission(app, guild, message.member)) {
    await v2MessageReply(message, { content: 'You do not have permission to use this command.' });
    return;
  }

  const targetId = parseTargetId(args[0]);
  if (!targetId) {
    await v2MessageReply(message, { content: 'Usage: `!clearwarnings <user>`' });
    return;
  }

  const targetMember = await guild.members.fetch(targetId).catch(() => null);
  if (targetMember && message.member) {
    const guard = app.modGuard.canModerate(targetMember, message.member);
    if (!guard.ok) {
      await v2MessageReply(message, { content: `Cannot clear warnings: ${guard.reason}` });
      return;
    }
  }

  const [rows] = await app.db.query<RowDataPacket[]>(
    'SELECT COUNT(*) AS count FROM warnings WHERE guild_id = ? AND user_id = ? AND active = 1',
    [guild.id, targetId],
  );
  const count = rows[0]?.count ?? 0;
  if (count === 0) {
    await v2MessageReply(message, { content: `<@${targetId}> has no active warnings.` });
    return;
  }

  const { sendButtonConfirm } = await import('../../components/moderation');
  const { confirmed: confirmed1 } = await sendButtonConfirm(app, message, 'clearwarnings', targetId, `FIRST CONFIRM: Clear ${count} warning(s)`);
  if (!confirmed1) return;

  const { confirmed: confirmed2 } = await sendButtonConfirm(app, message, 'clearwarnings', targetId, `FINAL CONFIRM: Permanently clear ${count} warning(s)`);
  if (!confirmed2) return;

  await executeClear(app, guild, targetId, count, message.author.id, message);
}

export async function executeClear(
  app: App,
  guild: { id: string },
  targetId: string,
  expectedCount: number | undefined,
  actorId: string,
  msg?: Message,
): Promise<number> {
  const [rows] = await app.db.query<RowDataPacket[]>(
    'SELECT id, case_id FROM warnings WHERE guild_id = ? AND user_id = ? AND active = 1',
    [guild.id, targetId],
  );

  if (rows.length === 0) {
    if (msg) await msg.reply('No active warnings found.').catch(() => undefined);
    return 0;
  }

  let cleared = 0;
  for (const row of rows) {
    await app.db.execute('UPDATE warnings SET active = 0 WHERE id = ?', [row.id]);
    await app.db.execute('UPDATE cases SET status = ? WHERE id = ?', ['closed', row.case_id]).catch(() => undefined);
    cleared++;
  }

  await app.logManager.log({
    event: 'member_unwarn',
    guildId: guild.id,
    actorId,
    targetId,
    message: `<@${actorId}> cleared ${cleared} warning(s) for <@${targetId}>`,
    details: { clearedCount: cleared, expectedCount: expectedCount ?? cleared },
  });

  if (msg) {
    await msg.reply(`Cleared ${cleared} warning(s) for <@${targetId}>.`).catch(() => undefined);
  }
  return cleared;
}

const command: BotCommand = {
  name: 'clearwarnings',
  category: 'moderation',
  description: 'Clear all active warnings for a user (requires double confirmation)',
  usage: '!clearwarnings <user>',
  details: 'Double confirmation warning purge. Clears every active warning for a user and closes the related cases. Restricted to staff with clearwarnings permission (Trial Mod+) or bot/server owners.',
  data,
  permissions: ['ModerateMembers'],
  aliases: ['clearwarns', 'cw'],
  execute,
  prefixExecute,
};

export default command;
