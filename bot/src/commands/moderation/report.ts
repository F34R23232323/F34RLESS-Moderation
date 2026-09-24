import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import type { ChatInputCommandInteraction, Message, MessageContextMenuCommandInteraction, UserContextMenuCommandInteraction } from 'discord.js';
import type { App } from '../../core/context';
import type { BotCommand } from '../../types/command';
import { v2Reply } from '../../utils/v2';
import { v2MessageReply } from '../../utils/v2';
import { parseTargetId } from '../../utils/moderationErrors';
import { buildIgnoreAllConfirmation } from '../../components/reports';

const data = new SlashCommandBuilder()
  .setName('report')
  .setDescription('Submit or manage reports')
  .addSubcommand((subcommand) => subcommand
    .setName('submit')
    .setDescription('Report a user to staff')
    .addUserOption((option) => option.setName('user').setDescription('User to report').setRequired(true))
    .addStringOption((option) => option.setName('reason').setDescription('Reason').setRequired(true)))
  .addSubcommandGroup((group) => group
    .setName('ignore')
    .setDescription('Ignore reports')
    .addSubcommand((subcommand) => subcommand
      .setName('all')
      .setDescription('Ignore and archive every open report')));

function canManageReports(member: { permissions: { has(permission: bigint): boolean }; roles: { cache: { some(callback: (role: { id: string }) => boolean): boolean } } }, app: App): boolean {
  return member.permissions.has(PermissionFlagsBits.ModerateMembers) ||
    (app.config.reports.action_roles.length > 0 && member.roles.cache.some((role) => app.config.reports.action_roles.includes(role.id)));
}

async function showIgnoreAllConfirmation(
  app: App,
  guildId: string,
  actorId: string,
): Promise<{ count: number; payload?: ReturnType<typeof buildIgnoreAllConfirmation> }> {
  const count = await app.reporting.countOpen(guildId);
  return { count, payload: count > 0 ? buildIgnoreAllConfirmation(count, actorId) : undefined };
}

async function execute(interaction: ChatInputCommandInteraction, app: App): Promise<void> {
  const guild = interaction.guild;
  if (!guild) return;
  if (interaction.options.getSubcommandGroup(false) === 'ignore') {
    const member = interaction.member;
    if (!member || !('permissions' in member) || !canManageReports(member as never, app)) {
      await v2Reply(interaction, 'You do not have permission to manage reports.', { ephemeral: true });
      return;
    }
    const confirmation = await showIgnoreAllConfirmation(app, guild.id, interaction.user.id);
    if (!confirmation.payload) {
      await v2Reply(interaction, 'There are no open reports to ignore.', { ephemeral: true });
      return;
    }
    await interaction.reply(confirmation.payload as never);
    return;
  }
  await interaction.deferReply({ ephemeral: true });
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
    targetContent: target.content.slice(0, 1000) || null,
    sourceChannelId: target.channelId,
    sourceModule: 'manual',
    attachmentUrls: [...target.attachments.values()].map((a) => a.url),
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
  const bulkIgnore = args[0]?.toLowerCase() === 'ignore' && args[1]?.toLowerCase() === 'all';
  if (guild && bulkIgnore) {
    if (!message.member || !canManageReports(message.member as never, app)) {
      await v2MessageReply(message, { content: 'You do not have permission to manage reports.' });
      return;
    }
    const count = await app.reporting.countOpen(guild.id);
    if (count === 0) {
      await v2MessageReply(message, { content: 'There are no open reports to ignore.' });
      return;
    }
    await (message.channel as any).send(buildIgnoreAllConfirmation(count, message.author.id, false));
    return;
  }
  const targetId = parseTargetId(args[0]);
  const reason = args.slice(1).join(' ') || 'No reason given';
  if (!guild || !targetId) {
    await v2MessageReply(message, { content: 'Usage: `!report <user> <reason>`' });
    return;
  }
  const cfg = app.config.reports;
  if (!cfg.enabled) {
    await v2MessageReply(message, { content: 'Reporting is disabled.' });
    return;
  }
  if (!app.cooldowns.tryConsume('report', message.author.id, guild.id, cfg.cooldown_seconds)) {
    await v2MessageReply(message, { content: `You can report again in ${app.cooldowns.remainingSeconds('report', message.author.id, guild.id)}s.` });
    return;
  }
  const result = await app.reporting.createReport({ guildId: guild.id, reporterId: message.author.id, targetUserId: targetId, reason });
  await v2MessageReply(message, { content: result.merged ? 'Your report was merged with an existing one.' : 'Report submitted. Thank you.' });
}

const command: BotCommand = {
  name: 'report',
  category: 'moderation',
  description: 'Report a user to staff',
  usage: ['!report <user> <reason>', '!report ignore all'],
  details: 'Reports go to the configured staff channel; reports within the merge window are merged together. `ignore all` is staff-only and archives every open report.',
  data,
  permissions: [],
  aliases: ['ria'],
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
