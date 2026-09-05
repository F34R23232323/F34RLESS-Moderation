import { SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction, Message } from 'discord.js';
import type { App } from '../../core/context';
import type { BotCommand } from '../../types/command';
import { v2Reply } from '../../utils/v2';
import { resolveMemberOption } from '../../utils/discord';
import { v2MessageReply } from '../../utils/v2';
import { resolveReplyContext, type CaseEvidenceItem } from '../../utils/evidence';
import { buildConfirmEmbed, storePendingAction } from '../../components/moderation';
import { parseTargetId, mapDiscordError } from '../../utils/moderationErrors';

const data = new SlashCommandBuilder()
  .setName('kick')
  .setDescription('Kick a user from the server')
  .addUserOption((o) => o.setName('user').setDescription('Target user').setRequired(true))
  .addStringOption((o) => o.setName('reason').setDescription('Reason').setRequired(false));

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
  const reason = interaction.options.getString('reason') ?? 'No reason provided';
  const actionId = storePendingAction({
    action: 'kick', targetUserId: resolved.user.id, guildId: guild.id, channelId: interaction.channelId,
    reason, actorId: interaction.user.id, expiresAt: Date.now() + 60_000,
  });
  const { components, flags } = buildConfirmEmbed('Kick', resolved.user.id, reason, undefined, actionId);
  await interaction.editReply({ components, flags } as never);
}

async function prefixExecute(message: Message, args: string[], app: App): Promise<void> {
  const guild = message.guild;
  if (!guild) { await v2MessageReply(message, { content: 'Usage: `!kick <user> <reason>`' }); return; }
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

  const { sendButtonConfirm } = await import('../../components/moderation');
  const { confirmed } = await sendButtonConfirm(app, message, 'kick', targetId, reason);
  if (!confirmed) return;

  const result = await app.punishmentManager.kick(member, { reason, moderatorId: message.author.id, archiveChannelId: message.channel?.id ?? null, evidence });
  await v2MessageReply(message, { content: result.ok ? `Kicked <@${targetId}> — case ${result.case!.case_code}.` : `Failed: ${mapDiscordError(result.error!)}` });
}

const command: BotCommand = {
  name: 'kick', category: 'moderation', description: 'Kick a user from the server',
  data, permissions: ['KickMembers'], aliases: ['k', 'kik'], execute, prefixExecute,
};

export default command;
