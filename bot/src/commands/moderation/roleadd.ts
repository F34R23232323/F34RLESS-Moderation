import { SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction, Message } from 'discord.js';
import type { App } from '../../core/context';
import type { BotCommand } from '../../types/command';
import { v2Reply } from '../../utils/v2';
import { resolveMemberOption } from '../../utils/discord';
import { v2MessageReply } from '../../utils/v2';
import { parseTargetId, mapDiscordError } from '../../utils/moderationErrors';

const data = new SlashCommandBuilder()
  .setName('roleadd')
  .setDescription('Add a role to a user')
  .addUserOption((o) => o.setName('user').setDescription('Target user').setRequired(true))
  .addRoleOption((o) => o.setName('role').setDescription('Role to add').setRequired(true))
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
  if (resolved.member.roles.cache.has(role.id)) {
    await v2Reply(interaction, `<@${resolved.user!.id}> already has the ${role.name} role.`, { ephemeral: true });
    return;
  }
  const reason = interaction.options.getString('reason') ?? 'No reason provided';
  try {
    await resolved.member.roles.add(role.id, reason);
    await v2Reply(interaction, `Added **${role.name}** to <@${resolved.user!.id}>.`);
  } catch (err) {
    await v2Reply(interaction, `Failed: ${mapDiscordError((err as Error).message)}`, { ephemeral: true });
  }
}

async function prefixExecute(message: Message, args: string[], app: App): Promise<void> {
  const guild = message.guild;
  if (!guild) {
    await v2MessageReply(message, { content: 'Usage: `!roleadd <user> <role> [reason]`' });
    return;
  }
  const targetId = parseTargetId(args[0]);
  const roleId = args[1]?.replace(/[<@&>]/g, '');
  const reason = args.slice(2).join(' ') || 'No reason provided';
  if (!targetId || !roleId) {
    await v2MessageReply(message, { content: 'Usage: `!roleadd <user> <role> [reason]`' });
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
  if (member.roles.cache.has(roleId)) {
    await v2MessageReply(message, { content: `<@${targetId}> already has the ${role.name} role.` });
    return;
  }
  try {
    await member.roles.add(roleId, reason);
    await v2MessageReply(message, { content: `Added **${role.name}** to <@${targetId}>.` });
  } catch (err) {
    await v2MessageReply(message, { content: `Failed: ${mapDiscordError((err as Error).message)}` });
  }
}

const command: BotCommand = {
  name: 'roleadd',
  category: 'moderation',
  description: 'Add a role to a user',
  usage: '!roleadd <user> <role> [reason]',
  data,
  permissions: ['ManageRoles'],
  aliases: ['ra'],
  execute,
  prefixExecute,
};

export default command;
