import { MessageFlags, PermissionFlagsBits, SlashCommandBuilder, type ChatInputCommandInteraction, type Message } from 'discord.js';
import type { App } from '../../core/context';
import { LogChannelSetupService, type LogLayout } from '../../services/logChannelSetupService';
import type { BotCommand } from '../../types/command';
import { v2Reply } from '../../utils/v2';

const data = new SlashCommandBuilder()
  .setName('logsetup')
  .setDescription('Create and configure a clean Discord logging layout')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .addStringOption((option) => option
    .setName('format')
    .setDescription('How logging channels should be organized')
    .setRequired(true)
    .addChoices(
      { name: 'Single channel', value: 'single' },
      { name: 'Grouped channels without a category', value: 'split' },
      { name: 'Grouped channels in one category', value: 'compact_categories' },
      { name: 'Event channels divided into categories', value: 'categories' },
      { name: 'One forum with grouped posts', value: 'forum' },
      { name: 'One forum with a post for every event', value: 'event_forum' },
      { name: 'Multiple forums with an event post for every log', value: 'forums' },
      { name: 'Hybrid forums and grouped text channels', value: 'hybrid' },
    ));

async function execute(interaction: ChatInputCommandInteraction, app: App): Promise<void> {
  if (!interaction.guild) {
    await v2Reply(interaction, 'This command can only be used in a server.', { ephemeral: true });
    return;
  }
  const layout = interaction.options.getString('format', true) as LogLayout;
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  try {
    const result = await new LogChannelSetupService(app).create(interaction.guild, interaction.user.id, layout);
    const summary = [
      '# Logging layout created',
      `**Format:** ${result.layout}`,
      `**Configured events:** ${result.configuredEvents}`,
      `**Created:** ${result.categoryCount} categories, ${result.channelCount} channels, ${result.postCount} forum posts`,
      result.mentions.length ? `**Location:** ${result.mentions.join(' ')}` : '',
      '**Privacy:** Hidden from @everyone',
      '',
      'The new routing is active now and has been saved to `config.yml`.',
    ].filter(Boolean).join('\n');
    await v2Reply(interaction, summary, { ephemeral: true });
  } catch (error) {
    app.logger.error('Failed to create logging layout', error);
    await v2Reply(interaction, `Could not create the logging layout: ${(error as Error).message}`, { ephemeral: true });
  }
}

async function prefixExecute(message: Message): Promise<void> {
  await message.reply('Use `/logsetup` to preview the available logging formats and create one safely.');
}

const command: BotCommand = {
  name: 'logsetup', category: 'admin', description: 'Create a clean logging channel layout',
  data, permissions: ['ManageGuild'], guildOnly: true, execute, prefixExecute,
};

export default command;
