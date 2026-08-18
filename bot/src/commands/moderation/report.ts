import { SlashCommandBuilder, ApplicationCommandType } from 'discord.js';
import type { ChatInputCommandInteraction, Message, MessageContextMenuCommandInteraction, UserContextMenuCommandInteraction } from 'discord.js';
import type { App } from '../../core/context';
import type { BotCommand } from '../../types/command';
import { v2Reply } from '../../utils/v2';

const data = new SlashCommandBuilder()
  .setName('report')
  .setDescription('Report a user to staff')
  .addUserOption((o) => o.setName('user').setDescription('User to report').setRequired(true))
  .addStringOption((o) => o.setName('reason').setDescription('Reason').setRequired(true));

async function execute(interaction: ChatInputCommandInteraction, app: App): Promise<void> {
  await interaction.deferReply({ ephemeral: true });
  const guild = interaction.guild;
  if (!guild) return;
  const user = interaction.options.getUser('user', true);
  const reason = interaction.options.getString('reason', true);
  const cfg = app.config.reports;
  if (!cfg.enabled) {
    await v2Reply(interaction, 'Reporting is disabled.', { ephemeral: true });
    return;
  }
  if (!app.cooldowns.tryConsume('report', interaction.user.id, guild.id, cfg.cooldown_seconds)) {
    await v2Reply(interaction, `You can report again in ${app.cooldowns.remainingSeconds('report', interaction.user.id, guild.id)}s.`, { ephemeral: true });
    return;
  }
  const result = await app.reporting.createReport({
    guildId: guild.id,
    reporterId: interaction.user.id,
    targetUserId: user.id,
    reason,
  });
  await v2Reply(interaction, result.merged ? 'Your report was merged with an existing one.' : 'Report submitted. Thank you.', { ephemeral: true });
}

async function messageContext(app: App, interaction: MessageContextMenuCommandInteraction): Promise<void> {
  const guild = interaction.guild;
  if (!guild) return;
  const target = interaction.targetMessage;
  const result = await app.reporting.createReport({
    guildId: guild.id,
    reporterId: interaction.user.id,
    targetUserId: target.author?.id,
    targetMessageId: target.id,
    reason: target.content.slice(0, 200) || 'reported message',
  });
  await interaction.reply({ content: result.merged ? 'Report merged with an existing one.' : 'Report submitted.', ephemeral: true });
}

async function userContext(app: App, interaction: UserContextMenuCommandInteraction): Promise<void> {
  const guild = interaction.guild;
  if (!guild) return;
  await app.reporting.createReport({
    guildId: guild.id,
    reporterId: interaction.user.id,
    targetUserId: interaction.targetUser.id,
    reason: 'reported via context menu',
  });
  await interaction.reply({ content: 'Report submitted.', ephemeral: true });
}

async function prefixExecute(message: Message, args: string[], app: App): Promise<void> {
  const guild = message.guild;
  const targetId = args[0]?.replace(/[<@!>]/g, '');
  const reason = args.slice(1).join(' ') || 'No reason given';
  if (!guild || !targetId) {
    await message.reply({ content: 'Usage: `!report <user> <reason>`' });
    return;
  }
  await app.reporting.createReport({ guildId: guild.id, reporterId: message.author.id, targetUserId: targetId, reason });
  await message.reply({ content: 'Report submitted.' });
}

const command: BotCommand = {
  name: 'report',
  category: 'moderation',
  description: 'Report a user to staff',
  data,
  permissions: [],
  aliases: [],
  execute,
  prefixExecute,
  asMessageContext: true,
  asUserContext: true,
  async contextExecute(interaction, app) {
    if (interaction.isMessageContextMenuCommand()) {
      await messageContext(app, interaction);
    } else if (interaction.isUserContextMenuCommand()) {
      await userContext(app, interaction);
    }
  },
};

export default command;