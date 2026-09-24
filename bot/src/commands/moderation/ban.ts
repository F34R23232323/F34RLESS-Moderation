import { SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction, Message } from 'discord.js';
import type { App } from '../../core/context';
import type { BotCommand } from '../../types/command';
import { v2Reply } from '../../utils/v2';
import { resolveUserOption } from '../../utils/discord';
import { parseDuration, humanizeDuration } from '../../../../shared/src/index';
import { v2MessageReply } from '../../utils/v2';
import { resolveReplyContext, type CaseEvidenceItem } from '../../utils/evidence';
import { buildConfirmEmbed, storePendingAction, contextUserConfirm } from '../../components/moderation';
import { parseTargetId, mapDiscordError } from '../../utils/moderationErrors';
import { collectSlashEvidence, collectMessageImageEvidence } from '../../utils/evidenceImages';

const data = new SlashCommandBuilder()
  .setName('ban')
  .setDescription('Ban a user (optionally temporary)')
  .addUserOption((o) => o.setName('user').setDescription('Target user (in-server mention)').setRequired(false))
  .addStringOption((o) => o.setName('user_id').setDescription('Target user ID (for users not in the server)').setRequired(false))
  .addStringOption((o) => o.setName('reason').setDescription('Reason').setRequired(false))
  .addStringOption((o) => o.setName('duration').setDescription('Optional temporary ban, e.g. 7d').setRequired(false))
  .addIntegerOption((o) => o.setName('delete_days').setDescription('Days of messages to delete').setMinValue(0).setMaxValue(7).setRequired(false))
  .addBooleanOption((o) => o.setName('anonymous').setDescription('Hide your identity in the user\'s DM').setRequired(false))
  .addAttachmentOption((o) => o.setName('evidence').setDescription('Image evidence to store with the case').setRequired(false));

async function execute(interaction: ChatInputCommandInteraction, app: App): Promise<void> {
  await interaction.deferReply({ ephemeral: true });
  const guild = interaction.guild;
  if (!guild) return;

  let user = await resolveUserOption(interaction, app);
  if (!user) {
    const rawId = interaction.options.getString('user_id');
    const targetId = rawId ? parseTargetId(rawId) : null;
    if (targetId) {
      user = await app.client.users.fetch(targetId).catch(() => null);
    }
  }
  if (!user) {
    const hasUserOption = interaction.options.getUser('user');
    const hasUserIdOption = interaction.options.getString('user_id');
    if (!hasUserOption && !hasUserIdOption) {
      await v2Reply(interaction, 'Provide a `user` mention or a `user_id` string.', { ephemeral: true });
      return;
    }
    await v2Reply(interaction, 'User not found. Provide a valid user mention or user ID.', { ephemeral: true });
    return;
  }
  const member = await guild.members.fetch(user.id).catch(() => null);
  if (member && interaction.member) {
    const guard = app.modGuard.canModerate(member, interaction.member as never);
    if (!guard.ok) {
      await v2Reply(interaction, `Cannot ban: ${guard.reason}`, { ephemeral: true });
      return;
    }
    if (await app.whitelist.isWhitelisted(guild.id, user.id, 'moderation')) {
      await v2Reply(interaction, 'Cannot ban: this user is whitelisted from moderation actions.', { ephemeral: true });
      return;
    }
  }
  const reason = interaction.options.getString('reason') ?? 'No reason provided';
  const durationStr = interaction.options.getString('duration');
  const durationMs = durationStr ? (parseDuration(durationStr)?.milliseconds ?? 0) : 0;
  const deleteDays = interaction.options.getInteger('delete_days') ?? 0;
  const anonymous = interaction.options.getBoolean('anonymous') ?? false;

  const evidence = await collectSlashEvidence(app, interaction);
  const actionId = storePendingAction({
    action: 'ban', targetUserId: user.id, guildId: guild.id, channelId: interaction.channelId,
    reason, evidence, durationMs: durationMs > 0 ? durationMs : undefined, deleteDays: deleteDays || undefined,
    actorId: interaction.user.id, expiresAt: Date.now() + 60_000, anonymous: anonymous || undefined,
  });
  const { components, flags } = buildConfirmEmbed('Ban', user.id, reason, durationMs > 0 ? durationMs : undefined, actionId);
  await interaction.editReply({ components, flags } as never);
}

async function prefixExecute(message: Message, args: string[], app: App): Promise<void> {
  const guild = message.guild;
  if (!guild) {
    await v2MessageReply(message, { content: 'Usage: `!ban <user> [duration] <reason>`' });
    return;
  }
  const anonymous = args.includes('--anon');
  if (anonymous) args = args.filter(a => a !== '--anon');
  const replyCtx = await resolveReplyContext(message);
  let targetId = parseTargetId(args[0]) ?? (replyCtx ? replyCtx.targetId : null);
  let durationStr = args[1];
  let reason = args.slice(2).join(' ') || 'No reason provided';
  let evidence: CaseEvidenceItem[] | undefined;
  if (!parseTargetId(args[0]) && replyCtx) {
    durationStr = args[0];
    reason = args.slice(1).join(' ') || 'No reason provided';
    evidence = replyCtx.evidence;
  }
  if (!targetId) {
    await v2MessageReply(message, { content: 'Usage: `!ban <user> [duration] <reason>` — or reply to a message to ban its author.' });
    return;
  }
  const member = await guild.members.fetch(targetId).catch(() => null);
  if (member) {
    const guard = app.modGuard.canModerate(member, message.member!);
    if (!guard.ok) { await v2MessageReply(message, { content: `Cannot ban: ${guard.reason}` }); return; }
    if (await app.whitelist.isWhitelisted(guild.id, targetId, 'moderation')) {
      await v2MessageReply(message, { content: 'Cannot ban: this user is whitelisted from moderation actions.' });
      return;
    }
  }
  const durationMs = durationStr ? (parseDuration(durationStr)?.milliseconds ?? 0) : 0;

  const images = await collectMessageImageEvidence(app, message);
  if (images.length > 0) evidence = [...(evidence ?? []), ...images];
  const { sendButtonConfirm } = await import('../../components/moderation');
  const { confirmed } = await sendButtonConfirm(app, message, 'ban', targetId, reason, durationMs > 0 ? durationMs : undefined);
  if (!confirmed) return;

  const targetUser = await app.client.users.fetch(targetId).catch(() => null);
  if (!targetUser) {
    await (message.channel as any).send({ content: '❌ User not found.', allowedMentions: { parse: [] } }).catch(() => undefined);
    return;
  }

  let result;
  try {
    result = await app.punishmentManager.ban(targetUser, { reason, moderatorId: message.author.id, archiveChannelId: message.channel?.id ?? null, durationMs: durationMs > 0 ? durationMs : undefined, evidence, anonymous: anonymous || undefined });
  } catch (err) {
    app.logger.error('Ban command threw:', err);
    await (message.channel as any).send({ content: `❌ Ban failed: ${(err as Error).message}`, allowedMentions: { parse: [] } }).catch(() => undefined);
    return;
  }
  const dur = durationMs > 0 ? ` for ${humanizeDuration(durationMs)}` : '';
  const replyContent = result.ok ? `Banned <@${targetId}>${dur} — case ${result.case!.case_code}.` : `❌ Failed: ${mapDiscordError(result.error!)}`;
  await (message.channel as any).send({ content: replyContent, allowedMentions: { parse: [] } }).catch(() => undefined);
}

const command: BotCommand = {
  name: 'ban',
  category: 'moderation',
  description: 'Ban a user (optionally temporary)',
  usage: '!ban <user> [duration] <reason>',
  details: 'Optional duration (e.g. `7d`) makes it a temporary ban that lifts automatically. Reply to a message to ban its author; add `--anon` to hide your identity. The slash form also accepts `user_id`, `delete_days`, and `anonymous`.',
  data,
  permissions: ['BanMembers'],
  aliases: ['b', 'bann'],
  execute,
  prefixExecute,
  asUserContext: true,
  async contextExecute(interaction, app) {
    if (!interaction.isUserContextMenuCommand()) return;
    const targetUser = await app.client.users.fetch(interaction.targetUser.id).catch(() => null);
    if (!targetUser) return;
    await contextUserConfirm(app, interaction, 'ban', 'No reason provided', () =>
      app.punishmentManager.ban(targetUser, { reason: 'No reason provided', moderatorId: interaction.user.id, archiveChannelId: interaction.channelId }),
    );
  },
};

export default command;
