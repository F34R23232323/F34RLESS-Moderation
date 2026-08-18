import { SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction, Message } from 'discord.js';
import type { App } from '../../core/context';
import type { BotCommand } from '../../types/command';
import { v2Reply } from '../../utils/v2';

const data = new SlashCommandBuilder()
  .setName('membercount')
  .setDescription('Live member count (humans/bots)');

async function execute(interaction: ChatInputCommandInteraction, app: App): Promise<void> {
  const guild = interaction.guild;
  if (!guild) return;
  const humans = guild.members.cache.filter((m) => !m.user.bot).size;
  const bots = guild.members.cache.filter((m) => m.user.bot).size;
  await v2Reply(interaction, `Members: **${guild.memberCount}** (${humans} humans, ${bots} bots)`);
}

async function prefixExecute(message: Message, _args: string[], app: App): Promise<void> {
  const guild = message.guild;
  if (!guild) return;
  await message.reply({ content: `Members: **${guild.memberCount}**` });
}

const command: BotCommand = {
  name: 'membercount',
  category: 'utility',
  description: 'Live member count (humans/bots)',
  data,
  permissions: [],
  aliases: ['mc'],
  execute,
  prefixExecute,
};

export default command;