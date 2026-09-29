import { SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction, Message } from 'discord.js';
import type { App } from '../../core/context';
import type { BotCommand } from '../../types/command';
import { v2Reply } from '../../utils/v2';
import { resolveUserOption } from '../../utils/discord';
import { v2MessageReply } from '../../utils/v2';
import { resolveReplyContext, type CaseEvidenceItem } from '../../utils/evidence';
import { sendConfirmation, contextUserConfirm } from '../../components/moderation';
import { parseTargetId, mapDiscordError } from '../../utils/moderationErrors';
import { collectSlashEvidence, collectMessageImageEvidence } from '../../utils/evidenceImages';
import { sendModerationResponse } from '../../utils/moderationResponse';

const data = new SlashCommandBuilder()
  .setName('softban')
  .setDescription('Ban and immediately unban to purge messages')
  .addUserOption((o) => o.setName('user').setDescription('Target user').setRequired(true))
  .addStringOption((o) => o.setName('reason').setDescription('Reason').setRequired(false))
  .addAttachmentOption((o) => o.setName('evidence').setDescription('Image evidence to store with the case').setRequired(false));

async function execute(interaction: ChatInputCommandInteraction, app: App): Promise<void> {
  await interaction.deferReply({ ephemeral: true });
  const guild = interaction.guild;
  if (!guild) return;
  const user = await resolveUserOption(interaction, app);
  if (!user) { await v2Reply(interaction, 'User not found.', { ephemeral: true }); return; }
  const reason = interaction.options.getString('reason') ?? 'No reason provided';
  const evidence = await collectSlashEvidence(app, interaction);
  await sendConfirmation(interaction, {
    action: 'softban', targetUserId: user.id, reason,
    guildId: guild.id, channelId: interaction.channelId, actorId: interaction.user.id, evidence,
  });
}

async function prefixExecute(message: Message, args: string[], app: App): Promise<void> {
  const guild = message.guild;
  if (!guild) { await v2MessageReply(message, { content: 'Usage: `!softban <user> <reason>`' }); return; }
  const replyCtx = await resolveReplyContext(message);
  let targetId = parseTargetId(args[0]) ?? (replyCtx ? replyCtx.targetId : null);
  let reason = args.slice(1).join(' ') || 'No reason provided';
  let evidence: CaseEvidenceItem[] | undefined;
  if (!parseTargetId(args[0]) && replyCtx) { targetId = replyCtx.targetId; reason = args.join(' ') || 'No reason provided'; evidence = replyCtx.evidence; }
  if (!targetId) { await v2MessageReply(message, { content: 'Usage: `!softban <user> <reason>` — or reply to a message to softban its author.' }); return; }

  const images = await collectMessageImageEvidence(app, message);
  if (images.length > 0) evidence = [...(evidence ?? []), ...images];
  const { sendButtonConfirm } = await import('../../components/moderation');
  const { confirmed } = await sendButtonConfirm(app, message, 'softban', targetId, reason);
  if (!confirmed) return;

  const targetUser = await app.client.users.fetch(targetId).catch(() => null);
  if (!targetUser) {
    await (message.channel as any).send({ content: '❌ User not found.', allowedMentions: { parse: [] } }).catch(() => undefined);
    return;
  }

  const result = await app.punishmentManager.softban(targetUser, { reason, moderatorId: message.author.id, archiveChannelId: message.channel?.id ?? null, evidence });
  await sendModerationResponse(message, {
    action: 'softban',
    target: targetUser,
    ok: result.ok,
    reason,
    dmSent: result.dmSent,
    error: result.error,
  });
}


const command: BotCommand = {
  name: 'softban', category: 'moderation', description: 'Ban and immediately unban to purge messages',
  usage: '!softban <user> <reason>',
  details: 'Bans and unbans in one step so the member can return immediately while their recent messages are purged.',
  data, permissions: ['BanMembers'], aliases: ['sb'], execute, prefixExecute,
  asUserContext: true,
  async contextExecute(interaction, app) {
    if (!interaction.isUserContextMenuCommand()) return;
    await contextUserConfirm(app, interaction, 'softban', 'No reason provided');
  },
};

export default command;
