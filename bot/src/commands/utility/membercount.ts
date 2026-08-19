import { SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction, Message } from 'discord.js';
import type { App } from '../../core/context';
import type { BotCommand } from '../../types/command';
import { v2Reply } from '../../utils/v2';
import { v2MessageReply } from '../../utils/v2';

function memberCountLine(guild: any): string {
  const humans = guild.members.cache.filter((m: any) => !m.user.bot).size;
  const bots = guild.members.cache.filter((m: any) => m.user.bot).size;
  return `Members: **${guild.memberCount}** (${humans} humans, ${bots} bots)`;
}

const data = new SlashCommandBuilder()
  .setName('membercount')
  .setDescription('Live member count (humans/bots)');

async function execute(interaction: ChatInputCommandInteraction, app: App): Promise<void> {
  const guild = interaction.guild;
  if (!guild) return;
  await v2Reply(interaction, memberCountLine(guild));
}

async function prefixExecute(message: Message, _args: string[], app: App): Promise<void> {
  const guild = message.guild;
  if (!guild) return;
  await v2MessageReply(message, { content: memberCountLine(guild) });
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