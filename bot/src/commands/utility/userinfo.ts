import { SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction, Message } from 'discord.js';
import type { App } from '../../core/context';
import type { BotCommand } from '../../types/command';
import { v2Reply } from '../../utils/v2';
import { resolveUserOption } from '../../utils/discord';

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
  const lines = [
    `**${user.username}** (<@${user.id}>)`,
    `Account created: <t:${Math.floor(user.createdTimestamp / 1000)}:f>`,
    member ? `Joined: <t:${Math.floor(member.joinedTimestamp! / 1000)}:f>` : 'Not in this server',
    member?.premiumSince ? `Boosting since: <t:${Math.floor(member.premiumSinceTimestamp! / 1000)}:f>` : 'Not boosting',
    member?.voice.channel ? `Voice: ${member.voice.channel.name}` : 'Voice: none',
    member ? `Roles: ${member.roles.cache.filter((r) => r.id !== guild.id).map((r) => `<@&${r.id}>`).join(' ') || 'none'}` : 'Roles: n/a',
  ];
  await v2Reply(interaction, lines.join('\n'), { imageUrl: user.displayAvatarURL({ size: 256 }) });
}

async function prefixExecute(message: Message, args: string[], app: App): Promise<void> {
  const guild = message.guild;
  if (!guild) return;
  const targetId = args[0]?.replace(/[<@!>]/g, '') ?? message.author.id;
  const user = await app.client.users.fetch(targetId).catch(() => null);
  if (!user) {
    await message.reply({ content: 'User not found.' });
    return;
  }
  const member = await guild.members.fetch(user.id).catch(() => null);
  await message.reply({ content: `**${user.username}** — created <t:${Math.floor(user.createdTimestamp / 1000)}:D>${member ? `, joined <t:${Math.floor(member.joinedTimestamp! / 1000)}:D>` : ''}` });
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