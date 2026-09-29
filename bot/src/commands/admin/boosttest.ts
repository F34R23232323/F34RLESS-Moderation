import { SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction, Message } from 'discord.js';
import type { App } from '../../core/context';
import type { BotCommand } from '../../types/command';
import { v2Reply, v2MessageReply } from '../../utils/v2';
import { handleBoosterEvent } from '../../events/boosterEvent';

const data = new SlashCommandBuilder()
  .setName('boosttest')
  .setDescription('Test the booster message (owner only)');

async function execute(interaction: ChatInputCommandInteraction, app: App): Promise<void> {
  if (!interaction.guild || !interaction.member) return;
  
  if (!app.modGuard.isOwner(interaction.user.id)) {
    await v2Reply(interaction, 'Owner only.', { ephemeral: true });
    return;
  }

  await interaction.deferReply({ ephemeral: true });
  
  try {
    await handleBoosterEvent(app, interaction.member as any);
    await interaction.editReply('Boost message test triggered successfully.');
  } catch (error) {
    app.logger.error('Error in boosttest command:', error);
    await interaction.editReply('Failed to trigger boost message.');
  }
}

async function prefixExecute(message: Message, _args: string[], app: App): Promise<void> {
  if (!message.guild || !message.member) return;
  
  if (!app.modGuard.isOwner(message.author.id)) {
    await v2MessageReply(message, { content: 'Owner only.' });
    return;
  }

  try {
    await handleBoosterEvent(app, message.member as any);
    await v2MessageReply(message, { content: 'Boost message test triggered successfully.' });
  } catch (error) {
    app.logger.error('Error in boosttest prefix command:', error);
    await v2MessageReply(message, { content: 'Failed to trigger boost message.' });
  }
}

export const command: BotCommand = {
  name: 'boosttest',
  category: 'admin',
  description: 'Test the booster message (owner only)',
  data,
  execute,
  prefixExecute,
};
