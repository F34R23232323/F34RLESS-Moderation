import { SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction, Message } from 'discord.js';
import type { App } from '../../core/context';
import type { BotCommand } from '../../types/command';
import { v2Reply } from '../../utils/v2';
import { resolveMemberOption } from '../../utils/discord';
import { v2MessageReply } from '../../utils/v2';
import { resolveReplyContext, type CaseEvidenceItem } from '../../utils/evidence';
import { sendConfirmation, contextUserConfirm } from '../../components/moderation';
import { parseTargetId, mapDiscordError } from '../../utils/moderationErrors';
import { collectSlashEvidence, collectMessageImageEvidence } from '../../utils/evidenceImages';
import { sendModerationResponse } from '../../utils/moderationResponse';

const data = new SlashCommandBuilder()
  .setName('kick')
  .setDescription('Kick a user from the server')
  .addUserOption((o) => o.setName('user').setDescription('Target user').setRequired(true))
  .addStringOption((o) => o.setName('reason').setDescription('Reason').setRequired(false))
  .addBooleanOption((o) => o.setName('anonymous').setDescription('Hide your identity in the user\'s DM').setRequired(false))
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
  const guard = app.modGuard.canModerate(resolved.member, interaction.member as never);
  if (!guard.ok) {
    await v2Reply(interaction, `Cannot kick: ${guard.reason}`, { ephemeral: true });
    return;
  }
  if (await app.whitelist.isWhitelisted(guild.id, resolved.user.id, 'moderation')) {
    await v2Reply(interaction, 'Cannot kick: this user is whitelisted from moderation actions.', { ephemeral: true });
    return;
  }
  const reason = interaction.options.getString('reason') ?? 'No reason provided';
  const anonymous = interaction.options.getBoolean('anonymous') ?? false;
  const evidence = await collectSlashEvidence(app, interaction);
  await sendConfirmation(interaction, {
    action: 'kick', targetUserId: resolved.user.id, reason,
    guildId: guild.id, channelId: interaction.channelId, actorId: interaction.user.id,
    anonymous: anonymous || undefined, evidence,
  });
}

async function prefixExecute(message: Message, args: string[], app: App): Promise<void> {
  const guild = message.guild;
  if (!guild) { await v2MessageReply(message, { content: 'Usage: `!kick <user> <reason>`' }); return; }
  const anonymous = args.includes('--anon');
  if (anonymous) args = args.filter(a => a !== '--anon');
  const replyCtx = await resolveReplyContext(message);
  let targetId = parseTargetId(args[0]) ?? (replyCtx ? replyCtx.targetId : null);
  let reason = args.slice(1).join(' ') || 'No reason provided';
  let evidence: CaseEvidenceItem[] | undefined;
  if (!parseTargetId(args[0]) && replyCtx) { targetId = replyCtx.targetId; reason = args.join(' ') || 'No reason provided'; evidence = replyCtx.evidence; }
  if (!targetId) { await v2MessageReply(message, { content: 'Usage: `!kick <user> <reason>` — or reply to a message to kick its author.' }); return; }
  const member = await guild.members.fetch(targetId).catch(() => null);
  if (!member) { await v2MessageReply(message, { content: 'User not found.' }); return; }
  const guard = app.modGuard.canModerate(member, message.member!);
  if (!guard.ok) { await v2MessageReply(message, { content: `Cannot kick: ${guard.reason}` }); return; }
  if (await app.whitelist.isWhitelisted(guild.id, targetId, 'moderation')) {
    await v2MessageReply(message, { content: 'Cannot kick: this user is whitelisted from moderation actions.' });
    return;
  }

  const images = await collectMessageImageEvidence(app, message);
  if (images.length > 0) evidence = [...(evidence ?? []), ...images];
  const { sendButtonConfirm } = await import('../../components/moderation');
  const { confirmed } = await sendButtonConfirm(app, message, 'kick', targetId, reason);
  if (!confirmed) return;

  const result = await app.punishmentManager.kick(member, { reason, moderatorId: message.author.id, archiveChannelId: message.channel?.id ?? null, evidence, anonymous: anonymous || undefined });
  await sendModerationResponse(message, {
    action: 'kick',
    target: member,
    ok: result.ok,
    reason,
    dmSent: result.dmSent,
    error: result.error,
  });
}


const command: BotCommand = {
  name: 'kick', category: 'moderation', description: 'Kick a user from the server',
  usage: '!kick <user> <reason>',
  details: 'The member is removed but can rejoin at any time. Reply to a message to kick its author; add `--anon` to hide your identity.',
  data, permissions: ['KickMembers'], aliases: ['k', 'kik'], execute, prefixExecute,
  asUserContext: true,
  async contextExecute(interaction, app) {
    if (!interaction.isUserContextMenuCommand()) return;
    await contextUserConfirm(app, interaction, 'kick', 'No reason provided');
  },
};

export default command;
