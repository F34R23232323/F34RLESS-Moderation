import { SlashCommandBuilder, ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, ActionRowBuilder, StringSelectMenuBuilder, MessageFlags, PermissionFlagsBits } from 'discord.js';
import type { ChatInputCommandInteraction, Message } from 'discord.js';
import type { App } from '../../core/context';
import type { BotCommand } from '../../types/command';

const data = new SlashCommandBuilder()
  .setName('settings')
  .setDescription('Manage bot configuration, anti-nuke, anti-raid, and more')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild);

async function execute(interaction: ChatInputCommandInteraction, app: App): Promise<void> {
  await renderSettingsMenu(interaction, app);
}

async function prefixExecute(message: Message, args: string[], app: App): Promise<void> {
  if (!message.member?.permissions.has(PermissionFlagsBits.ManageGuild)) return;
  // Prefix command could send the same V2 message if supported, but for simplicity, we focus on slash commands for V2 components.
  await message.reply('Please use the `/settings` slash command to manage settings with the new UI.');
}

export async function renderSettingsMenu(interaction: ChatInputCommandInteraction | any, app: App, update = false) {
  const container = new ContainerBuilder()
    .setAccentColor(0x5865f2)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent('# ⚙️ Bot Settings Dashboard')
    )
    .addSeparatorComponents(new SeparatorBuilder())
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent('Please select a category below to configure settings for this server. Some settings (like full Config) must be managed on the web dashboard.')
    )
    .addActionRowComponents(
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId(`settings:menu:${interaction.guild?.id || ''}`)
          .setPlaceholder('Select a settings category...')
          .addOptions(
            { label: 'General / Prefix', value: 'general', description: 'Basic bot settings and prefix', emoji: '⚙️' },
            { label: 'Anti-Nuke', value: 'antinuke', description: 'Safety-first anti-nuke controls', emoji: '🛡️' },
            { label: 'Anti-Raid', value: 'antiraid', description: 'Configure or trigger anti-raid mode', emoji: '🚨' },
            { label: 'Reply Ping Protection', value: 'rpp', description: 'AutoMod rules for reply pings', emoji: '🔔' },
            { label: 'Config Validation', value: 'config', description: 'Validate the config.yml file', emoji: '✅' },
          )
      ) as never
    );

  const payload = {
    components: [container] as unknown[],
    flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
  };

  if (update && interaction.isRepliable() && typeof interaction.update === 'function') {
    await interaction.update(payload as never);
  } else if (interaction.deferred || interaction.replied) {
    await interaction.editReply(payload as never);
  } else {
    await interaction.reply(payload as never);
  }
}

const command: BotCommand = {
  name: 'settings',
  category: 'admin',
  description: 'Manage bot configuration',
  data,
  permissions: ['ManageGuild'],
  aliases: ['setup', 'config'],
  execute,
  prefixExecute,
};

export default command;
