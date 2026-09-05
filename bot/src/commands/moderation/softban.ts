import { SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction, Message } from 'discord.js';
import type { App } from '../../core/context';
import type { BotCommand } from '../../types/command';
import { v2Reply } from '../../utils/v2';
import { resolveUserOption } from '../../utils/discord';
import { v2MessageReply } from '../../utils/v2';
import { resolveReplyContext, type CaseEvidenceItem } from '../../utils/evidence';
import { buildConfirmEmbed, storePendingAction } from '../../components/moderation';
import { parseTargetId, mapDiscordError } from '../../utils/moderationErrors';

const data = new SlashCommandBuilder()
  .setName('softban')
  .setDescription('Ban and immediately unban to purge messages')
  .addUserOption((o) => o.setName('user').setDescription('Target user').setRequired(true))
  .addStringOption((o) => o.setName('reason').setDescription('Reason').setRequired(false));

async function execute(interaction: ChatInputCommandInteraction, app: App): Promise<void> {
  await interaction.deferReply({ ephemeral: true });
  const guild = interaction.guild;
  if (!guild) return;
  const user = await resolveUserOption(interaction, app);
  if (!user) { await v2Reply(interaction, 'User not found.', { ephemeral: true }); return; }
  const reason = interaction.options.getString('reason') ?? 'No reason provided';
  const actionId = storePendingAction({ action: 'softban', targetUserId: user.id, guildId: guild.id, channelId: interaction.channelId, reason, actorId: interaction.user.id, expiresAt: Date.now() + 60_000 });
  const { components, flags } = buildConfirmEmbed('Softban', user.id, reason, undefined, actionId);
  await interaction.editReply({ components, flags } as never);
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

  const { sendButtonConfirm } = await import('../../components/moderation');
  const { confirmed } = await sendButtonConfirm(app, message, 'softban', targetId, reason);
  if (!confirmed) return;

  const result = await app.punishmentManager.softban(targetId as never, { reason, moderatorId: message.author.id, archiveChannelId: message.channel?.id ?? null, evidence });
  await v2MessageReply(message, { content: result.ok ? `Softbanned <@${targetId}> — case ${result.case!.case_code}.` : `Failed: ${mapDiscordError(result.error!)}` });
}

const command: BotCommand = {
  name: 'softban', category: 'moderation', description: 'Ban and immediately unban to purge messages',
  data, permissions: ['BanMembers'], aliases: ['sb'], execute, prefixExecute,
};

export default command;
