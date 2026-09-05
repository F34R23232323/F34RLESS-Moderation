import { SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction, Message } from 'discord.js';
import type { App } from '../../core/context';
import type { BotCommand } from '../../types/command';
import { v2Reply } from '../../utils/v2';
import { v2MessageReply } from '../../utils/v2';

const data = new SlashCommandBuilder()
  .setName('unlockall')
  .setDescription('Unlock all channels that were locked by the bot');

async function execute(interaction: ChatInputCommandInteraction, app: App): Promise<void> {
  await interaction.deferReply();
  const guild = interaction.guild;
  if (!guild) return;
  const result = await app.lockingService.unlockAll(guild, `Unlockall by ${interaction.user.tag}`);
  await v2Reply(interaction, `Unlocked **${result.unlocked}** channel(s).${result.failed > 0 ? ` ${result.failed} failed.` : ''}`);
}

async function prefixExecute(message: Message, _args: string[], app: App): Promise<void> {
  const guild = message.guild;
  if (!guild) return;
  const result = await app.lockingService.unlockAll(guild, `Unlockall by ${message.author.tag}`);
  await v2MessageReply(message, { content: `Unlocked **${result.unlocked}** channel(s).${result.failed > 0 ? ` ${result.failed} failed.` : ''}` });
}

const command: BotCommand = {
  name: 'unlockall',
  category: 'moderation',
  description: 'Unlock all channels that were locked by the bot',
  data,
  permissions: ['ManageChannels'],
  aliases: ['unlockdownall'],
  execute,
  prefixExecute,
};

export default command;
