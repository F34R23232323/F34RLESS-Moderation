import { SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction, Message } from 'discord.js';
import type { App } from '../../core/context';
import type { BotCommand } from '../../types/command';
import { v2Reply } from '../../utils/v2';
import { v2MessageReply } from '../../utils/v2';

const data = new SlashCommandBuilder()
  .setName('unlock')
  .setDescription('Unlock channels locked with a named preset (byte-for-byte restore)')
  .addStringOption((o) => o.setName('preset').setDescription('Preset name').setRequired(true));

async function execute(interaction: ChatInputCommandInteraction, app: App): Promise<void> {
  await interaction.deferReply();
  const preset = interaction.options.getString('preset', true);
  try {
    const result = await app.lockingService.unlock(preset);
    await v2Reply(interaction, `Unlocked **${result.unlocked}** channel(s) with preset \`${preset}\`.${result.failed > 0 ? ` ${result.failed} failed.` : ''}`);
  } catch (err) {
    await v2Reply(interaction, `Failed: ${(err as Error).message}`, { ephemeral: true });
  }
}

async function prefixExecute(message: Message, args: string[], app: App): Promise<void> {
  const preset = args[0];
  if (!preset) {
    await v2MessageReply(message, { content: 'Usage: `!unlock <preset>`' });
    return;
  }
  try {
    const result = await app.lockingService.unlock(preset);
    await v2MessageReply(message, { content: `Unlocked **${result.unlocked}** channel(s) with preset \`${preset}\`.${result.failed > 0 ? ` ${result.failed} failed.` : ''}` });
  } catch (err) {
    await v2MessageReply(message, { content: `Failed: ${(err as Error).message}` });
  }
}

const command: BotCommand = {
  name: 'unlock',
  category: 'moderation',
  description: 'Unlock channels locked with a named preset (byte-for-byte restore)',
  data,
  permissions: ['ManageChannels'],
  aliases: [],
  execute,
  prefixExecute,
};

export default command;