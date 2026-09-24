import { SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction, Message } from 'discord.js';
import type { App } from '../../core/context';
import type { BotCommand } from '../../types/command';
import { v2Reply } from '../../utils/v2';
import { resolveUserOption } from '../../utils/discord';
import { v2MessageReply } from '../../utils/v2';
import { resolveReplyContext, type CaseEvidenceItem } from '../../utils/evidence';
import { buildConfirmEmbed, storePendingAction, contextUserConfirm } from '../../components/moderation';
import { parseTargetId, mapDiscordError } from '../../utils/moderationErrors';
import { collectSlashEvidence, collectMessageImageEvidence } from '../../utils/evidenceImages';

const data = new SlashCommandBuilder()
  .setName('warn')
  .setDescription('Warn a user (creates a formal case)')
  .addUserOption((o) => o.setName('user').setDescription('Target user').setRequired(true))
  .addStringOption((o) => o.setName('reason').setDescription('Reason').setRequired(true))
  .addBooleanOption((o) => o.setName('anonymous').setDescription('Hide your identity in the user\'s DM').setRequired(false))
  .addAttachmentOption((o) => o.setName('evidence').setDescription('Image evidence to store with the case').setRequired(false));

async function execute(interaction: ChatInputCommandInteraction, app: App): Promise<void> {
  await interaction.deferReply({ ephemeral: true });
  const guild = interaction.guild;
  if (!guild) return;
  const user = await resolveUserOption(interaction, app);
  if (!user) {
    await v2Reply(interaction, 'User not found.', { ephemeral: true });
    return;
  }
  if (await app.whitelist.isWhitelisted(guild.id, user.id, 'moderation')) {
    await v2Reply(interaction, 'Cannot warn: this user is whitelisted from moderation actions.', { ephemeral: true });
    return;
  }
  const reason = interaction.options.getString('reason', true);
  const anonymous = interaction.options.getBoolean('anonymous') ?? false;
  const imageEvidence = await collectSlashEvidence(app, interaction);
  const actionId = storePendingAction({ action: 'warn', targetUserId: user.id, guildId: guild.id, channelId: interaction.channelId, reason, evidence: imageEvidence.length > 0 ? imageEvidence : undefined, actorId: interaction.user.id, expiresAt: Date.now() + 60_000, anonymous: anonymous || undefined });
  const { components, flags } = buildConfirmEmbed('Warn', user.id, reason, undefined, actionId);
  await interaction.editReply({ components, flags } as never);
}

async function prefixExecute(message: Message, args: string[], app: App): Promise<void> {
  const guild = message.guild;
  if (!guild) { await v2MessageReply(message, { content: 'Usage: `!warn <user> <reason>`' }); return; }
  const anonymous = args.includes('--anon');
  if (anonymous) args = args.filter(a => a !== '--anon');
  const replyCtx = await resolveReplyContext(message);
  let targetId = parseTargetId(args[0]) ?? (replyCtx ? replyCtx.targetId : null);
  let reason = args.slice(1).join(' ') || 'No reason provided';
  let evidence: CaseEvidenceItem[] | undefined;
  if (!parseTargetId(args[0]) && replyCtx) { targetId = replyCtx.targetId; reason = args.join(' ') || 'No reason provided'; evidence = replyCtx.evidence; }
  if (!targetId) { await v2MessageReply(message, { content: 'Usage: `!warn <user> <reason>` — or reply to a message to warn its author.' }); return; }
  const member = await guild.members.fetch(targetId).catch(() => null);
  if (!member) { await v2MessageReply(message, { content: 'User not found in this server.' }); return; }
  const guard = app.modGuard.canModerate(member, message.member!);
  if (!guard.ok) { await v2MessageReply(message, { content: `Cannot warn: ${guard.reason}` }); return; }
  if (await app.whitelist.isWhitelisted(guild.id, targetId, 'moderation')) {
    await v2MessageReply(message, { content: 'Cannot warn: this user is whitelisted from moderation actions.' });
    return;
  }

  const images = await collectMessageImageEvidence(app, message);
  if (images.length > 0) evidence = [...(evidence ?? []), ...images];
  const { sendButtonConfirm } = await import('../../components/moderation');
  const { confirmed } = await sendButtonConfirm(app, message, 'warn', targetId, reason);
  if (!confirmed) return;

  const result = await app.punishmentManager.warn(member, { reason, moderatorId: message.author.id, archiveChannelId: message.channel?.id ?? null, evidence, anonymous: anonymous || undefined });
  const content = result.ok ? `Warned <@${targetId}> — case ${result.case!.case_code}.` : `❌ Failed: ${mapDiscordError(result.error!)}`;
  await (message.channel as any).send({ content, allowedMentions: { parse: [] } }).catch(() => undefined);
}

const command: BotCommand = {
  name: 'warn', category: 'moderation', description: 'Warn a user (creates a formal case)',
  usage: '!warn <user> <reason>',
  details: 'Creates a formal case on the member record and DMs them the reason. Warnings can auto-escalate through the configured ladder. Reply to a message to warn its author; add `--anon` to hide your identity.',
  data, permissions: ['ModerateMembers'], aliases: ['w', 'warning'], execute, prefixExecute,
  asUserContext: true,
  async contextExecute(interaction, app) {
    if (!interaction.isUserContextMenuCommand()) return;
    await contextUserConfirm(app, interaction, 'warn', 'No reason provided', () =>
      app.punishmentManager.warn(interaction.targetUser as any, { reason: 'No reason provided', moderatorId: interaction.user.id, archiveChannelId: interaction.channelId }),
    );
  },
};

export default command;
