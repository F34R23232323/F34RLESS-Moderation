import { SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction, Message } from 'discord.js';
import type { App } from '../../core/context';
import type { BotCommand } from '../../types/command';
import { v2Reply } from '../../utils/v2';
import { resolveMemberOption } from '../../utils/discord';
import { v2MessageReply } from '../../utils/v2';
import { resolveReplyContext, type CaseEvidenceItem } from '../../utils/evidence';

const data = new SlashCommandBuilder()
  .setName('kick')
  .setDescription('Kick a user from the server')
  .addUserOption((o) => o.setName('user').setDescription('Target user').setRequired(true))
  .addStringOption((o) => o.setName('reason').setDescription('Reason').setRequired(false));

async function execute(interaction: ChatInputCommandInteraction, app: App): Promise<void> {
  await interaction.deferReply();
  const guild = interaction.guild;
  if (!guild) return;
  const resolved = await resolveMemberOption(interaction, guild, app);
  if (!resolved?.member) {
    await v2Reply(interaction, 'User not found in this server.', { ephemeral: true });
    return;
  }
  const guard = app.modGuard.canModerate(resolved.member, interaction.member as never);
  if (!guard.ok) {
    await v2Reply(interaction, `Cannot kick: ${guard.reason}`, { ephemeral: true });
    return;
  }
  const reason = interaction.options.getString('reason') ?? 'No reason provided';
  const result = await app.punishmentManager.kick(resolved.member, { reason, moderatorId: interaction.user.id, archiveChannelId: interaction.channel?.id ?? null });
  if (!result.ok) {
    await v2Reply(interaction, `Failed: ${result.error}`, { ephemeral: true });
    return;
  }
  await v2Reply(interaction, `Kicked <@${resolved.user!.id}> — case ${result.case!.case_code}.`);
}

async function prefixExecute(message: Message, args: string[], app: App): Promise<void> {
  const guild = message.guild;
  if (!guild) {
    await v2MessageReply(message, { content: 'Usage: `!kick <user> <reason>`' });
    return;
  }
  const replyCtx = await resolveReplyContext(message);
  let targetId = args[0]?.replace(/[<@!>]/g, '');
  let reason = args.slice(1).join(' ') || 'No reason provided';
  let evidence: CaseEvidenceItem[] | undefined;
  if (!targetId && replyCtx) {
    targetId = replyCtx.targetId;
    reason = args.join(' ') || 'No reason provided';
    evidence = replyCtx.evidence;
  }
  if (!targetId) {
    await v2MessageReply(message, { content: 'Usage: `!kick <user> <reason>` — or reply to a message to kick its author.' });
    return;
  }
  const member = await guild.members.fetch(targetId).catch(() => null);
  if (!member) {
    await v2MessageReply(message, { content: 'User not found.' });
    return;
  }
  const guard = app.modGuard.canModerate(member, message.member!);
  if (!guard.ok) {
    await v2MessageReply(message, { content: `Cannot kick: ${guard.reason}` });
    return;
  }
  const result = await app.punishmentManager.kick(member, { reason, moderatorId: message.author.id, archiveChannelId: message.channel?.id ?? null, evidence });
  await v2MessageReply(message, { content: result.ok ? `Kicked <@${targetId}> — case ${result.case!.case_code}.` : `Failed: ${result.error}` });
}

const command: BotCommand = {
  name: 'kick',
  category: 'moderation',
  description: 'Kick a user from the server',
  data,
  permissions: ['KickMembers'],
  aliases: ['k', 'kik'],
  execute,
  prefixExecute,
};

export default command;