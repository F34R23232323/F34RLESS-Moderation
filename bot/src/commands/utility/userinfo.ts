import { SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction, GuildMember, Message, User } from 'discord.js';
import type { App } from '../../core/context';
import type { BotCommand } from '../../types/command';
import { v2Reply } from '../../utils/v2';
import { v2MessageReply } from '../../utils/v2';

const NITRO: Record<number, string> = { 0: 'None', 1: 'Nitro Classic', 2: 'Nitro', 3: 'Nitro Basic' };

function badgeList(user: User): string {
  const flags = user.flags?.toArray() ?? [];
  if (flags.length === 0) return 'none';
  return flags.map((f) => `\`${f}\``).join(' ');
}

function userInfoLines(guild: { id: string }, user: User, member: GuildMember | null): string[] {
  const lines: string[] = [];
  lines.push(`**${user.username}** (<@${user.id}>)`);
  if (user.globalName) lines.push(`**Global name:** ${user.globalName}`);
  lines.push(`**User ID:** \`${user.id}\``);
  lines.push(`**Bot:** ${user.bot ? 'Yes' : 'No'}`);
  lines.push(`**Account created:** <t:${Math.floor(user.createdTimestamp / 1000)}:f> (<t:${Math.floor(user.createdTimestamp / 1000)}:R>)`);
  lines.push(`**Badges:** ${badgeList(user)}`);
  const premiumType = (user as unknown as { premiumType?: number }).premiumType;
  if (premiumType !== undefined) lines.push(`**Nitro:** ${NITRO[premiumType] ?? 'Unknown'}`);
  if (user.hexAccentColor) lines.push(`**Accent color:** ${user.hexAccentColor}`);
  if (user.banner) lines.push(`**Banner:** ${user.bannerURL({ size: 512 })}`);

  if (member) {
    lines.push('');
    lines.push('# In Server');
    if (member.nickname) lines.push(`**Nickname:** ${member.nickname}`);
    lines.push(`**Joined:** <t:${Math.floor(member.joinedTimestamp! / 1000)}:f> (<t:${Math.floor(member.joinedTimestamp! / 1000)}:R>)`);
    if (member.communicationDisabledUntilTimestamp) {
      const t = Math.floor(member.communicationDisabledUntilTimestamp / 1000);
      lines.push(`**Timed out until:** <t:${t}:f> (<t:${t}:R>)`);
    }
    if (member.pending) lines.push(`**Pending verification:** Yes`);
    const highest = member.roles.highest.id !== guild.id ? member.roles.highest : null;
    if (highest) lines.push(`**Highest role:** <@&${highest.id}>`);
    lines.push(`**Boosting since:** ${member.premiumSince ? `<t:${Math.floor(member.premiumSinceTimestamp! / 1000)}:f>` : 'Not boosting'}`);
    lines.push(`**Voice:** ${member.voice.channel ? member.voice.channel.name : 'none'}`);
    const roles = member.roles.cache.filter((r) => r.id !== guild.id);
    lines.push(`**Roles (${roles.size}):** ${roles.map((r) => `<@&${r.id}>`).join(' ') || 'none'}`);
  } else {
    lines.push('Not in this server');
  }

  return lines;
}

const data = new SlashCommandBuilder()
  .setName('userinfo')
  .setDescription('User info: join date, roles, boost, voice, badges')
  .addUserOption((o) => o.setName('user').setDescription('Target user').setRequired(false));

async function execute(interaction: ChatInputCommandInteraction, app: App): Promise<void> {
  await interaction.deferReply();
  const guild = interaction.guild;
  if (!guild) return;
  const user = interaction.options.getUser('user') ?? interaction.user;
  const member = await guild.members.fetch(user.id).catch(() => null);
  await v2Reply(interaction, userInfoLines(guild, user, member).join('\n'), { imageUrl: user.displayAvatarURL({ size: 256 }) });
}

async function prefixExecute(message: Message, args: string[], app: App): Promise<void> {
  const guild = message.guild;
  if (!guild) return;
  const targetId = args[0]?.replace(/[<@!>]/g, '') ?? message.author.id;
  const user = await app.client.users.fetch(targetId).catch(() => null);
  if (!user) {
    await v2MessageReply(message, { content: 'User not found.' });
    return;
  }
  const member = await guild.members.fetch(user.id).catch(() => null);
  await v2MessageReply(message, { content: userInfoLines(guild, user, member).join('\n'), imageUrl: user.displayAvatarURL({ size: 256 }) });
}

const command: BotCommand = {
  name: 'userinfo',
  category: 'utility',
  description: 'User info: join date, roles, boost, voice, badges',
  data,
  permissions: [],
  aliases: ['ui', 'whois'],
  execute,
  prefixExecute,
};

export default command;
