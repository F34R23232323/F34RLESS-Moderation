import { SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction, Message } from 'discord.js';
import type { App } from '../../core/context';
import type { BotCommand } from '../../types/command';
import { v2Reply } from '../../utils/v2';
import { resolveMemberOption } from '../../utils/discord';
import { parseDuration } from '../../../../shared/src/index';
import { v2MessageReply } from '../../utils/v2';
import { parseTargetId, mapDiscordError } from '../../utils/moderationErrors';
import { sendModerationResponse } from '../../utils/moderationResponse';

const data = new SlashCommandBuilder()
  .setName('temprole')
  .setDescription('Apply a role for a duration (auto-removes)')
  .addUserOption((o) => o.setName('user').setDescription('Target user').setRequired(true))
  .addRoleOption((o) => o.setName('role').setDescription('Role to apply').setRequired(true))
  .addStringOption((o) => o.setName('duration').setDescription('Duration like 1h, 7d').setRequired(true))
  .addStringOption((o) => o.setName('reason').setDescription('Reason').setRequired(false));

async function execute(interaction: ChatInputCommandInteraction, app: App): Promise<void> {
  await interaction.deferReply({ ephemeral: true });
  const guild = interaction.guild;
  if (!guild) return;
  const resolved = await resolveMemberOption(interaction, guild, app);
  const role = interaction.options.getRole('role');
  if (!resolved?.member || !role) {
    await v2Reply(interaction, 'User or role not found.', { ephemeral: true });
    return;
  }
  const guard = app.modGuard.isAboveRole(interaction.member as never, role as never);
  if (!guard.ok) {
    await v2Reply(interaction, `Cannot use that role: ${guard.reason}`, { ephemeral: true });
    return;
  }
  const duration = parseDuration(interaction.options.getString('duration', true));
  if (!duration || duration.isPermanent) {
    await v2Reply(interaction, 'Provide a valid duration.', { ephemeral: true });
    return;
  }
  const reason = interaction.options.getString('reason') ?? `Temporary role ${role.name}`;
  const result = await app.punishmentManager.tempRole(resolved.member, role.id, duration.milliseconds, { reason, moderatorId: interaction.user.id });
  await sendModerationResponse(interaction, {
    action: 'temprole',
    target: resolved.member,
    ok: result.ok,
    durationMs: duration.milliseconds,
    reason: `${reason} (role: <@&${role.id}>)`,
    dmSent: result.dmSent,
    error: result.error,
  });
}

async function prefixExecute(message: Message, args: string[], app: App): Promise<void> {
  const guild = message.guild;
  const targetId = parseTargetId(args[0]);
  const roleId = args[1]?.replace(/[<@&>]/g, '');
  const durationStr = args[2];
  const reason = args.slice(3).join(' ') || 'Temporary role';
  if (!guild || !targetId || !roleId || !durationStr) {
    await v2MessageReply(message, { content: 'Usage: `!temprole <user> <role> <duration> <reason>`' });
    return;
  }
  const member = await guild.members.fetch(targetId).catch(() => null);
  if (!member) {
    await v2MessageReply(message, { content: 'User not found.' });
    return;
  }
  const duration = parseDuration(durationStr);
  if (!duration || duration.isPermanent) {
    await v2MessageReply(message, { content: 'Provide a valid duration.' });
    return;
  }
  const result = await app.punishmentManager.tempRole(member, roleId, duration.milliseconds, { reason, moderatorId: message.author.id });
  await sendModerationResponse(message, {
    action: 'temprole',
    target: member,
    ok: result.ok,
    durationMs: duration.milliseconds,
    reason: `${reason} (role: <@&${roleId}>)`,
    dmSent: result.dmSent,
    error: result.error,
  });
}


const command: BotCommand = {
  name: 'temprole',
  category: 'moderation',
  description: 'Apply a role for a duration (auto-removes)',
  usage: '!temprole <user> <role> <duration> <reason>',
  details: 'The role is removed automatically once the duration expires.',
  data,
  permissions: ['ManageRoles'],
  aliases: ['tr'],
  execute,
  prefixExecute,
};

export default command;