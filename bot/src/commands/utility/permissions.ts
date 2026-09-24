import { SlashCommandBuilder, PermissionsBitField } from 'discord.js';
import type { ChatInputCommandInteraction, Message } from 'discord.js';
import type { App } from '../../core/context';
import type { BotCommand } from '../../types/command';
import { v2Reply } from '../../utils/v2';
import { v2MessageReply } from '../../utils/v2';

function permissionLines(member: any, channel: any): string {
  const perms = (channel as { permissionsFor: (m: unknown) => { toArray: () => string[] } }).permissionsFor(member);
  const array = perms.toArray();
  const granted: string[] = [];
  for (const permName of array) {
    for (const role of member.roles.cache.values()) {
      const rolePerms = role.permissions;
      if (rolePerms.has(permName as never)) {
        granted.push(`${permName} (from <@&${role.id}>)`);
        break;
      }
    }
  }
  const adminOverride = granted.some((g) => g.startsWith('Administrator'));
  return `**Effective permissions for <@${member.id}> in <#${channel.id}>**\n${adminOverride ? 'Administrator (all permissions)' : granted.join('\n') || 'no permissions granted'}`;
}

const data = new SlashCommandBuilder()
  .setName('permissions')
  .setDescription('Permission utilities')
  .addSubcommand((s) => s.setName('check').setDescription('Effective permissions in this channel and why').addUserOption((o) => o.setName('user').setDescription('User').setRequired(true)));

async function execute(interaction: ChatInputCommandInteraction, app: App): Promise<void> {
  await interaction.deferReply();
  const guild = interaction.guild;
  if (!guild) return;
  const user = interaction.options.getUser('user', true);
  const member = await guild.members.fetch(user.id).catch(() => null);
  if (!member) {
    await v2Reply(interaction, 'User not found.', { ephemeral: true });
    return;
  }
  const channel = interaction.channel;
  if (!channel || !('permissionsFor' in channel)) {
    await v2Reply(interaction, 'Not available here.', { ephemeral: true });
    return;
  }
  await v2Reply(interaction, permissionLines(member, channel));
}

async function prefixExecute(message: Message, args: string[], app: App): Promise<void> {
  const guild = message.guild;
  const targetId = args[0]?.replace(/[<@!>]/g, '');
  if (!guild || !targetId) {
    await v2MessageReply(message, { content: 'Usage: `!permissions check <user>`' });
    return;
  }
  const member = await guild.members.fetch(targetId).catch(() => null);
  if (!member) {
    await v2MessageReply(message, { content: 'User not found.' });
    return;
  }
  if (!('permissionsFor' in message.channel)) {
    await v2MessageReply(message, { content: 'Not available here.' });
    return;
  }
  await v2MessageReply(message, { content: permissionLines(member, message.channel) });
}

const command: BotCommand = {
  name: 'permissions',
  category: 'utility',
  description: 'Permission utilities',
  usage: '!permissions <user>',
  details: 'Shows the effective permissions a member has in the current channel and which roles grant them.',
  data,
  permissions: [],
  aliases: ['perms'],
  execute,
  prefixExecute,
};

export default command;