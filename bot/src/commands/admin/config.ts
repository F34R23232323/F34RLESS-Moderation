import { SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction, Message } from 'discord.js';
import type { App } from '../../core/context';
import type { BotCommand } from '../../types/command';
import { v2Reply } from '../../utils/v2';

const data = new SlashCommandBuilder()
  .setName('config')
  .setDescription('View or validate the bot configuration (owner only)')
  .addSubcommand((s) => s.setName('view').setDescription('Show a config section'))
  .addSubcommand((s) => s.setName('validate').setDescription('Validate the current config'));

async function execute(interaction: ChatInputCommandInteraction, app: App): Promise<void> {
  await interaction.deferReply({ ephemeral: true });
  if (!app.modGuard.isOwner(interaction.user.id)) {
    await v2Reply(interaction, 'Owner only.', { ephemeral: true });
    return;
  }
  const sub = interaction.options.getSubcommand();
  if (sub === 'view') {
    const sections = Object.keys(app.config);
    await v2Reply(interaction, `**Config sections**\n${sections.join(', ')}\n\nFull config is editable on the web dashboard (see dashboard section).`);
  } else if (sub === 'validate') {
    const { loadConfig, formatConfigError } = await import('../../../../shared/src/config/load');
    try {
      loadConfig({ configPath: app.configPath });
      await v2Reply(interaction, 'Config is valid.');
    } catch (err) {
      await v2Reply(interaction, `Config invalid:\n\`\`\`\n${formatConfigError(err)}\n\`\`\``, { ephemeral: true });
    }
  }
}

const command: BotCommand = {
  name: 'config',
  category: 'admin',
  description: 'View or validate the bot configuration (owner only)',
  data,
  permissions: [],
  aliases: [],
  execute,
  ownerOnly: true,
};

export default command;