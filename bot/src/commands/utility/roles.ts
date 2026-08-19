import { SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction, Message } from 'discord.js';
import type { App } from '../../core/context';
import type { BotCommand } from '../../types/command';
import { v2Reply } from '../../utils/v2';
import { v2MessageReply } from '../../utils/v2';

function roleListLines(guild: any): string {
  const roles = [...guild.roles.cache.values()]
    .filter((r: any) => r.id !== guild.id)
    .sort((a: any, b: any) => b.position - a.position)
    .slice(0, 40);
  return `**Roles (${guild.roles.cache.size})**\n${roles.map((r: any) => `<@&${r.id}> (${r.members.size})`).join('\n')}`;
}

async function roleMembersLines(guild: any, role: any): Promise<string> {
  const members = await guild.members.fetch();
  const roleMembers = members.filter((m: any) => m.roles.cache.has(role.id));
  return `**<@&${role.id}> members (${roleMembers.size})**\n${roleMembers.first(30).map((m: any) => `<@${m.id}>`).join(' ') || 'none'}`;
}

const data = new SlashCommandBuilder()
  .setName('roles')
  .setDescription('Role utilities')
  .addSubcommand((s) => s.setName('list').setDescription('List all roles'))
  .addSubcommand((s) => s.setName('members').setDescription('List members of a role').addRoleOption((o) => o.setName('role').setDescription('Role').setRequired(true)));

async function execute(interaction: ChatInputCommandInteraction, app: App): Promise<void> {
  await interaction.deferReply();
  const guild = interaction.guild;
  if (!guild) return;
  const sub = interaction.options.getSubcommand();
  if (sub === 'list') {
    await v2Reply(interaction, roleListLines(guild));
  } else if (sub === 'members') {
    const role = interaction.options.getRole('role');
    if (!role) return;
    await v2Reply(interaction, await roleMembersLines(guild, role));
  }
}

async function prefixExecute(message: Message, args: string[], app: App): Promise<void> {
  const guild = message.guild;
  if (!guild) return;
  const sub = args[0] ?? 'list';
  if (sub === 'list') {
    await v2MessageReply(message, { content: roleListLines(guild) });
    return;
  }
  if (sub === 'members') {
    const roleId = args[1]?.replace(/[<@&>]/g, '');
    const role = roleId ? guild.roles.cache.get(roleId) : null;
    if (!role) {
      await v2MessageReply(message, { content: 'Role not found. Usage: `!roles members <role>`' });
      return;
    }
    await v2MessageReply(message, { content: await roleMembersLines(guild, role) });
    return;
  }
  await v2MessageReply(message, { content: 'Usage: `!roles list` | `!roles members <role>`' });
}

const command: BotCommand = {
  name: 'roles',
  category: 'utility',
  description: 'Role utilities',
  data,
  permissions: [],
  aliases: [],
  execute,
  prefixExecute,
};

export default command;