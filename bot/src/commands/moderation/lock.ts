import { SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction, Message } from 'discord.js';
import type { App } from '../../core/context';
import type { BotCommand } from '../../types/command';
import { v2Reply } from '../../utils/v2';

const data = new SlashCommandBuilder()
  .setName('lock')
  .setDescription('Lock channels using a named preset')
  .addStringOption((o) => o.setName('preset').setDescription('Preset name').setRequired(true));

async function execute(interaction: ChatInputCommandInteraction, app: App): Promise<void> {
  await interaction.deferReply();
  const preset = interaction.options.getString('preset', true);
  try {
    const result = await app.lockingService.lock(preset);
    await v2Reply(interaction, `Locked **${result.locked}** channel(s) with preset \`${preset}\`.${result.failed > 0 ? ` ${result.failed} failed.` : ''}`);
  } catch (err) {
    await v2Reply(interaction, `Failed: ${(err as Error).message}`, { ephemeral: true });
  }
}

async function prefixExecute(message: Message, args: string[], app: App): Promise<void> {
  const preset = args[0];
  if (!preset) {
    await message.reply({ content: 'Usage: `!lock <preset>`' });
    return;
  }
  const result = await app.lockingService.lock(preset);
  await message.reply({ content: `Locked **${result.locked}** channel(s).` });
}

const command: BotCommand = {
  name: 'lock',
  category: 'moderation',
  description: 'Lock channels using a named preset',
  data,
  permissions: ['ManageChannels'],
  aliases: ['lockdown'],
  execute,
  prefixExecute,
};

export default command;