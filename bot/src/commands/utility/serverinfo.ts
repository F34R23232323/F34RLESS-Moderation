import { SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction, Message } from 'discord.js';
import type { App } from '../../core/context';
import type { BotCommand } from '../../types/command';
import { v2Reply } from '../../utils/v2';

const data = new SlashCommandBuilder()
  .setName('serverinfo')
  .setDescription('Server info: members, channels, roles, boost tier');

async function execute(interaction: ChatInputCommandInteraction, app: App): Promise<void> {
  await interaction.deferReply();
  const guild = interaction.guild;
  if (!guild) return;
  const humans = guild.members.cache.filter((m) => !m.user.bot).size;
  const bots = guild.members.cache.filter((m) => m.user.bot).size;
  const text = guild.channels.cache.filter((c) => c.isTextBased()).size;
  const voice = guild.channels.cache.filter((c) => c.isVoiceBased()).size;
  const lines = [
    `**${guild.name}**`,
    `Owner: ${(await guild.fetchOwner().catch(() => null))?.user.tag ?? 'unknown'}`,
    `Created: <t:${Math.floor(guild.createdTimestamp / 1000)}:f>`,
    `Members: ${guild.memberCount} (humans ${humans}, bots ${bots})`,
    `Channels: ${text} text, ${voice} voice, ${guild.channels.cache.filter((c) => c.type === 4).size} categories`,
    `Roles: ${guild.roles.cache.size}`,
    `Boost tier: ${guild.premiumTier} (${guild.premiumSubscriptionCount ?? 0} boosts)`,
    `Verification: ${guild.verificationLevel}`,
    `Features: ${guild.features.slice(0, 10).join(', ') || 'none'}`,
  ];
  await v2Reply(interaction, lines.join('\n'), { imageUrl: guild.iconURL({ size: 256 }) ?? undefined });
}

async function prefixExecute(message: Message, _args: string[], app: App): Promise<void> {
  const guild = message.guild;
  if (!guild) return;
  await message.reply({ content: `**${guild.name}** — ${guild.memberCount} members, tier ${guild.premiumTier}, created <t:${Math.floor(guild.createdTimestamp / 1000)}:D>. Run \`/serverinfo\` for full details.` });
}

const command: BotCommand = {
  name: 'serverinfo',
  category: 'utility',
  description: 'Server info: members, channels, roles, boost tier',
  data,
  permissions: [],
  aliases: ['si', 'guildinfo'],
  execute,
  prefixExecute,
};

export default command;