import { SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction, Message } from 'discord.js';
import type { RowDataPacket } from 'mysql2/promise';
import type { App } from '../../core/context';
import type { BotCommand } from '../../types/command';
import { v2Reply, v2MessageReply } from '../../utils/v2';
import { parseTargetId } from '../../utils/moderationErrors';

const REQUIRED_ROLE = '1520031216651210773';

function hasRequiredRole(member: { roles: { cache: { has(id: string): boolean } } }): boolean {
  return member.roles.cache.has(REQUIRED_ROLE);
}

const data = new SlashCommandBuilder()
  .setName('clearwarnings')
  .setDescription('Clear all active warnings for a user (requires double confirmation)')
  .addUserOption((o) => o.setName('user').setDescription('Target user').setRequired(true));

async function execute(interaction: ChatInputCommandInteraction, app: App): Promise<void> {
  const guild = interaction.guild;
  if (!guild) return;

  if (!hasRequiredRole(interaction.member as never)) {
    await v2Reply(interaction, 'You do not have permission to use this command.', { ephemeral: true });
    return;
  }

  const user = interaction.options.getUser('user');
  if (!user) {
    await v2Reply(interaction, 'User not found.', { ephemeral: true });
    return;
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

  const { storePendingAction, buildConfirmEmbed } = await import('../../components/moderation');
  const actionId = storePendingAction({
    action: 'clearwarnings',
    targetUserId: user.id,
    guildId: guild.id,
    channelId: interaction.channelId,
    reason: `Clear ${count} warnings`,
    actorId: interaction.user.id,
    expiresAt: Date.now() + 60_000,
  });

  const { components, flags } = buildConfirmEmbed(`Clear ${count} Warnings`, user.id, `This will permanently clear all ${count} active warning(s).`, undefined, actionId);
  await interaction.reply({ components, flags } as never);
}

async function prefixExecute(message: Message, args: string[], app: App): Promise<void> {
  const guild = message.guild;
  if (!guild) return;

  if (!hasRequiredRole(message.member!)) {
    await v2MessageReply(message, { content: 'You do not have permission to use this command.' });
    return;
  }

  const targetId = parseTargetId(args[0]);
  if (!targetId) {
    await v2MessageReply(message, { content: 'Usage: `!clearwarnings <user>`' });
    return;
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

async function executeClear(
  app: App,
  guild: { id: string },
  targetId: string,
  expectedCount: number,
  actorId: string,
  msg?: Message,
): Promise<void> {
  const [rows] = await app.db.query<RowDataPacket[]>(
    'SELECT id, case_id FROM warnings WHERE guild_id = ? AND user_id = ? AND active = 1',
    [guild.id, targetId],
  );

  if (rows.length === 0) {
    if (msg) await msg.reply('No active warnings found.').catch(() => undefined);
    return;
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
    details: { clearedCount: cleared, expectedCount },
  });

  if (msg) {
    await msg.reply(`Cleared ${cleared} warning(s) for <@${targetId}>.`).catch(() => undefined);
  }
}

const command: BotCommand = {
  name: 'clearwarnings',
  category: 'moderation',
  description: 'Clear all active warnings for a user (requires double confirmation)',
  data,
  permissions: ['ModerateMembers'],
  aliases: ['clearwarns', 'cw'],
  execute,
  prefixExecute,
};

export default command;
