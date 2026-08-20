import { SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction, Collection, Guild, GuildMember, Message, Role } from 'discord.js';
import type { App } from '../../core/context';
import type { BotCommand } from '../../types/command';
import { paginateV2, chunkItems } from '../../utils/paginate';

function allRoles(guild: Guild): Role[] {
  return [...guild.roles.cache.values()]
    .filter((r) => r.id !== guild.id)
    .sort((a, b) => b.position - a.position);
}

async function fetchAllMembers(guild: Guild): Promise<Collection<string, GuildMember>> {
  return guild.members.fetch();
}

async function roleMembersLines(guild: Guild, role: Role): Promise<string[]> {
  const members = await fetchAllMembers(guild);
  const roleMembers = members.filter((m) => m.roles.cache.has(role.id));
  return roleMembers.map((m) => `<@${m.id}>`);
}

async function roleMemberCounts(guild: Guild): Promise<Map<string, number>> {
  const members = await fetchAllMembers(guild);
  const counts = new Map<string, number>();
  for (const r of guild.roles.cache.values()) counts.set(r.id, 0);
  for (const m of members.values()) {
    for (const rid of m.roles.cache.keys()) {
      if (counts.has(rid)) counts.set(rid, (counts.get(rid) ?? 0) + 1);
    }
  }
  return counts;
}

const PAGE_SIZE = 20;

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
    const roles = allRoles(guild);
    if (roles.length === 0) {
      await paginateV2({ trigger: interaction, authorId: interaction.user.id, title: '**Roles (0)**', pages: ['No roles found.'] });
      return;
    }
    const counts = await roleMemberCounts(guild);
    const pages = chunkItems(
      roles.map((r) => `<@&${r.id}> — ${(counts.get(r.id) ?? 0).toLocaleString()} members`),
      PAGE_SIZE,
    ).map((c) => c.join('\n'));
    await paginateV2({
      trigger: interaction,
      authorId: interaction.user.id,
      title: `**Roles (${roles.length})** — Page {page}/{total}`,
      pages,
    });
  } else if (sub === 'members') {
    const role = interaction.options.getRole('role');
    if (!role) return;
    const members = await roleMembersLines(guild, role as Role);
    if (members.length === 0) {
      await paginateV2({ trigger: interaction, authorId: interaction.user.id, title: `**<@&${role.id}> members (0)**`, pages: ['No members.'] });
      return;
    }
    const pages = chunkItems(members, PAGE_SIZE).map((c) => c.join('\n'));
    await paginateV2({
      trigger: interaction,
      authorId: interaction.user.id,
      title: `**<@&${role.id}> members (${members.length})** — Page {page}/{total}`,
      pages,
    });
  }
}

async function prefixExecute(message: Message, args: string[], app: App): Promise<void> {
  const guild = message.guild;
  if (!guild) return;
  const sub = args[0] ?? 'list';
  if (sub === 'list') {
    const roles = allRoles(guild);
    if (roles.length === 0) {
      await paginateV2({ trigger: message, authorId: message.author.id, title: '**Roles (0)**', pages: ['No roles found.'] });
      return;
    }
    const counts = await roleMemberCounts(guild);
    const pages = chunkItems(roles.map((r) => `<@&${r.id}> — ${(counts.get(r.id) ?? 0).toLocaleString()} members`), PAGE_SIZE).map((c) => c.join('\n'));
    await paginateV2({ trigger: message, authorId: message.author.id, title: `**Roles (${roles.length})** — Page {page}/{total}`, pages });
    return;
  }
  if (sub === 'members') {
    const roleId = args[1]?.replace(/[<@&>]/g, '');
    const role = roleId ? guild.roles.cache.get(roleId) : null;
    if (!role) {
      await message.reply('Role not found. Usage: `!roles members <role>`');
      return;
    }
    const members = await roleMembersLines(guild, role);
    if (members.length === 0) {
      await paginateV2({ trigger: message, authorId: message.author.id, title: `**<@&${role.id}> members (0)**`, pages: ['No members.'] });
      return;
    }
    const pages = chunkItems(members, PAGE_SIZE).map((c) => c.join('\n'));
    await paginateV2({ trigger: message, authorId: message.author.id, title: `**<@&${role.id}> members (${members.length})** — Page {page}/{total}`, pages });
    return;
  }
  await message.reply('Usage: `!roles list` | `!roles members <role>`');
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

