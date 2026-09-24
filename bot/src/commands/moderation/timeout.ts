import { SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction, Message } from 'discord.js';
import type { App } from '../../core/context';
import type { BotCommand } from '../../types/command';
import { v2Reply } from '../../utils/v2';
import { resolveMemberOption } from '../../utils/discord';
import { parseDuration, humanizeDuration } from '../../../../shared/src/index';
import { v2MessageReply } from '../../utils/v2';
import { resolveReplyContext, type CaseEvidenceItem } from '../../utils/evidence';
import { buildConfirmEmbed, storePendingAction, contextUserConfirm } from '../../components/moderation';
import { parseTargetId, mapDiscordError } from '../../utils/moderationErrors';
import { collectSlashEvidence, collectMessageImageEvidence } from '../../utils/evidenceImages';

const data = new SlashCommandBuilder()
  .setName('timeout')
  .setDescription('Apply a timeout to a user')
  .addUserOption((o) => o.setName('user').setDescription('Target user').setRequired(true))
  .addStringOption((o) => o.setName('duration').setDescription('Duration like 10m, 2h, 14d').setRequired(true))
  .addStringOption((o) => o.setName('reason').setDescription('Reason').setRequired(false))
  .addAttachmentOption((o) => o.setName('evidence').setDescription('Image evidence to store with the case').setRequired(false));

async function execute(interaction: ChatInputCommandInteraction, app: App): Promise<void> {
  await interaction.deferReply({ ephemeral: true });
  const guild = interaction.guild;
  if (!guild) return;
  const resolved = await resolveMemberOption(interaction, guild, app);
  if (!resolved?.member || !resolved?.user) {
    await v2Reply(interaction, 'User not found in this server.', { ephemeral: true });
    return;
  }
  const duration = parseDuration(interaction.options.getString('duration', true));
  if (!duration || duration.isPermanent) {
    await v2Reply(interaction, 'Provide a valid duration.', { ephemeral: true });
    return;
  }
  const reason = interaction.options.getString('reason') ?? 'No reason provided';
  const evidence = await collectSlashEvidence(app, interaction);
  const actionId = storePendingAction({ action: 'timeout', targetUserId: resolved.user.id, guildId: guild.id, channelId: interaction.channelId, reason, evidence, durationMs: duration.milliseconds, actorId: interaction.user.id, expiresAt: Date.now() + 60_000 });
  const { components, flags } = buildConfirmEmbed('Timeout', resolved.user.id, reason, duration.milliseconds, actionId);
  await interaction.editReply({ components, flags } as never);
}

async function prefixExecute(message: Message, args: string[], app: App): Promise<void> {
  const guild = message.guild;
  if (!guild) { await v2MessageReply(message, { content: 'Usage: `!timeout <user> <duration> <reason>`' }); return; }
  const replyCtx = await resolveReplyContext(message);
  let targetId = parseTargetId(args[0]) ?? (replyCtx ? replyCtx.targetId : null);
  let durationStr = args[1];
  let reason = args.slice(2).join(' ') || 'No reason provided';
  let evidence: CaseEvidenceItem[] | undefined;
  if (!parseTargetId(args[0]) && replyCtx) { targetId = replyCtx.targetId; durationStr = args[0]; reason = args.slice(1).join(' ') || 'No reason provided'; evidence = replyCtx.evidence; }
  if (!targetId || !durationStr) { await v2MessageReply(message, { content: 'Usage: `!timeout <user> <duration> <reason>` — or reply to a message to time out its author.' }); return; }
  const member = await guild.members.fetch(targetId).catch(() => null);
  if (!member) { await v2MessageReply(message, { content: 'User not found.' }); return; }
  const duration = parseDuration(durationStr);
  if (!duration || duration.isPermanent) { await v2MessageReply(message, { content: 'Provide a valid duration.' }); return; }

  const images = await collectMessageImageEvidence(app, message);
  if (images.length > 0) evidence = [...(evidence ?? []), ...images];
  const { sendButtonConfirm } = await import('../../components/moderation');
  const { confirmed } = await sendButtonConfirm(app, message, 'timeout', targetId, reason, duration.milliseconds);
  if (!confirmed) return;

  const result = await app.punishmentManager.timeout(member, duration.milliseconds, { reason, moderatorId: message.author.id, archiveChannelId: message.channel?.id ?? null, evidence });
  const durStr = humanizeDuration(duration.milliseconds);
  const content = result.ok ? `Timed out <@${targetId}> for ${durStr} — case ${result.case!.case_code}.` : `❌ Failed: ${mapDiscordError(result.error!)}`;
  await (message.channel as any).send({ content, allowedMentions: { parse: [] } }).catch(() => undefined);
}

const command: BotCommand = {
  name: 'timeout', category: 'moderation', description: 'Apply a timeout to a user',
  usage: '!timeout <user> <duration> <reason>',
  details: 'Applies a Discord timeout for the given duration (e.g. `10m`, `2h`, `14d`, max 28d). Reply to a message to time out its author.',
  data, permissions: ['ModerateMembers'], aliases: ['to'], execute, prefixExecute,
  asUserContext: true,
  async contextExecute(interaction, app) {
    if (!interaction.isUserContextMenuCommand()) return;
    await contextUserConfirm(app, interaction, 'timeout', 'No reason provided', async () => {
      const member = await interaction.guild?.members.fetch(interaction.targetUser.id).catch(() => null);
      if (!member) return { ok: false, error: 'User not found in server', dmSent: false };
      return app.punishmentManager.timeout(member, 600_000, { reason: 'No reason provided', moderatorId: interaction.user.id, archiveChannelId: interaction.channelId });
    }, { durationMs: 600_000 });
  },
};

export default command;
