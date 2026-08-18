import { SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction } from 'discord.js';
import type { App } from '../../core/context';
import type { BotCommand } from '../../types/command';
import { v2Reply } from '../../utils/v2';

const data = new SlashCommandBuilder()
  .setName('verify')
  .setDescription('Post the verification gate panel (staff)');

async function execute(interaction: ChatInputCommandInteraction, app: App): Promise<void> {
  const cfg = app.config.verification_gate;
  const guild = interaction.guild;
  if (!cfg.enabled || !guild) {
    await v2Reply(interaction, 'Verification gate is not enabled.', { ephemeral: true });
    return;
  }
  const { v2Send } = await import('../../utils/v2');
  await v2Send(interaction.channel as any, 'Click the button below to verify and gain access to the server.', {
    buttons: [{ customId: `verify:${interaction.user.id}`, label: 'Verify', style: 3 }],
  });
  await v2Reply(interaction, 'Verification panel posted.', { ephemeral: true });
}

const command: BotCommand = {
  name: 'verify',
  category: 'admin',
  description: 'Post the verification gate panel (staff)',
  data,
  permissions: ['ManageGuild'],
  aliases: ['verifypanel'],
  execute,
};

export default command;