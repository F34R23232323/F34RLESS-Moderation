import { SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction, Message } from 'discord.js';
import type { App } from '../../core/context';
import type { BotCommand } from '../../types/command';
import { v2Reply } from '../../utils/v2';
import { resolveMemberOption } from '../../utils/discord';
import { v2MessageReply } from '../../utils/v2';
import { parseTargetId, mapDiscordError } from '../../utils/moderationErrors';

const data = new SlashCommandBuilder()
  .setName('roleremove')
  .setDescription('Remove a role from a user')
  .addUserOption((o) => o.setName('user').setDescription('Target user').setRequired(true))
  .addRoleOption((o) => o.setName('role').setDescription('Role to remove').setRequired(true))
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
  if (!resolved.member.roles.cache.has(role.id)) {
    await v2Reply(interaction, `<@${resolved.user!.id}> does not have the ${role.name} role.`, { ephemeral: true });
    return;
  }
  const reason = interaction.options.getString('reason') ?? 'No reason provided';
  try {
    await resolved.member.roles.remove(role.id, reason);
    await v2Reply(interaction, `Removed **${role.name}** from <@${resolved.user!.id}>.`);
  } catch (err) {
    await v2Reply(interaction, `Failed: ${mapDiscordError((err as Error).message)}`, { ephemeral: true });
  }
}

async function prefixExecute(message: Message, args: string[], app: App): Promise<void> {
  const guild = message.guild;
  if (!guild) {
    await v2MessageReply(message, { content: 'Usage: `!roleremove <user> <role> [reason]`' });
    return;
  }
  const targetId = parseTargetId(args[0]);
  const roleId = args[1]?.replace(/[<@&>]/g, '');
  const reason = args.slice(2).join(' ') || 'No reason provided';
  if (!targetId || !roleId) {
    await v2MessageReply(message, { content: 'Usage: `!roleremove <user> <role> [reason]`' });
    return;
  }
  const member = await guild.members.fetch(targetId).catch(() => null);
  if (!member) {
    await v2MessageReply(message, { content: 'User not found in this server.' });
    return;
  }
  const role = guild.roles.cache.get(roleId);
  if (!role) {
    await v2MessageReply(message, { content: 'Role not found.' });
    return;
  }
  const guard = app.modGuard.isAboveRole(message.member!, role);
  if (!guard.ok) {
    await v2MessageReply(message, { content: `Cannot use that role: ${guard.reason}` });
    return;
  }
  if (!member.roles.cache.has(roleId)) {
    await v2MessageReply(message, { content: `<@${targetId}> does not have the ${role.name} role.` });
    return;
  }
  try {
    await member.roles.remove(roleId, reason);
    await v2MessageReply(message, { content: `Removed **${role.name}** from <@${targetId}>.` });
  } catch (err) {
    await v2MessageReply(message, { content: `Failed: ${mapDiscordError((err as Error).message)}` });
  }
}

const command: BotCommand = {
  name: 'roleremove',
  category: 'moderation',
  description: 'Remove a role from a user',
  data,
  permissions: ['ManageRoles'],
  aliases: ['rr'],
  execute,
  prefixExecute,
};

export default command;
