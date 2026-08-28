import { SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction, Message } from 'discord.js';
import type { App } from '../../core/context';
import type { BotCommand } from '../../types/command';
import { v2Reply } from '../../utils/v2';
import { resolveMemberOption } from '../../utils/discord';
import { parseDuration } from '../../../../shared/src/index';
import { v2MessageReply } from '../../utils/v2';
import { resolveReplyContext, type CaseEvidenceItem } from '../../utils/evidence';

const data = new SlashCommandBuilder()
  .setName('timeout')
  .setDescription('Apply a timeout to a user')
  .addUserOption((o) => o.setName('user').setDescription('Target user').setRequired(true))
  .addStringOption((o) => o.setName('duration').setDescription('Duration like 30m, 2h').setRequired(true))
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
    await v2Reply(interaction, `Cannot timeout: ${guard.reason}`, { ephemeral: true });
    return;
  }
  const duration = parseDuration(interaction.options.getString('duration', true));
  if (!duration || duration.isPermanent) {
    await v2Reply(interaction, 'Provide a valid duration (e.g. 30m, 2h).', { ephemeral: true });
    return;
  }
  const reason = interaction.options.getString('reason') ?? 'No reason provided';
  const result = await app.punishmentManager.timeout(resolved.member, duration.milliseconds, { reason, moderatorId: interaction.user.id, archiveChannelId: interaction.channel?.id ?? null });
  if (!result.ok) {
    await v2Reply(interaction, `Failed: ${result.error}`, { ephemeral: true });
    return;
  }
  await v2Reply(interaction, `Timed out <@${resolved.user!.id}> — case ${result.case!.case_code}.`);
}

async function prefixExecute(message: Message, args: string[], app: App): Promise<void> {
  const guild = message.guild;
  if (!guild) {
    await v2MessageReply(message, { content: 'Usage: `!timeout <user> <duration> <reason>`' });
    return;
  }
  const replyCtx = await resolveReplyContext(message);
  let targetId = args[0]?.replace(/[<@!>]/g, '');
  let durationStr = args[1];
  let reason = args.slice(2).join(' ') || 'No reason provided';
  let evidence: CaseEvidenceItem[] | undefined;
  if (!targetId && replyCtx) {
    targetId = replyCtx.targetId;
    durationStr = args[0];
    reason = args.slice(1).join(' ') || 'No reason provided';
    evidence = replyCtx.evidence;
  }
  if (!targetId || !durationStr) {
    await v2MessageReply(message, { content: 'Usage: `!timeout <user> <duration> <reason>` — or reply to a message to time out its author.' });
    return;
  }
  const member = await guild.members.fetch(targetId).catch(() => null);
  if (!member) {
    await v2MessageReply(message, { content: 'User not found.' });
    return;
  }
  const duration = parseDuration(durationStr);
  if (!duration || duration.isPermanent) {
    await v2MessageReply(message, { content: 'Provide a valid duration.' });
    return;
  }
  const result = await app.punishmentManager.timeout(member, duration.milliseconds, { reason, moderatorId: message.author.id, archiveChannelId: message.channel?.id ?? null, evidence });
  await v2MessageReply(message, { content: result.ok ? `Timed out <@${targetId}> — case ${result.case!.case_code}.` : `Failed: ${result.error}` });
}

const command: BotCommand = {
  name: 'timeout',
  category: 'moderation',
  description: 'Apply a timeout to a user',
  data,
  permissions: ['ModerateMembers'],
  aliases: ['to'],
  execute,
  prefixExecute,
};

export default command;