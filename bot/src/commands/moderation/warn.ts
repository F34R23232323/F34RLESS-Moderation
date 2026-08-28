import { SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction, Message } from 'discord.js';
import type { App } from '../../core/context';
import type { BotCommand } from '../../types/command';
import { v2Reply } from '../../utils/v2';
import { resolveUserOption } from '../../utils/discord';
import { parseDuration } from '../../../../shared/src/index';
import { v2MessageReply } from '../../utils/v2';
import { resolveReplyContext, type CaseEvidenceItem } from '../../utils/evidence';

const data = new SlashCommandBuilder()
  .setName('warn')
  .setDescription('Warn a user (creates a formal case)')
  .addUserOption((o) => o.setName('user').setDescription('Target user').setRequired(true))
  .addStringOption((o) => o.setName('reason').setDescription('Reason').setRequired(true))
  .addStringOption((o) => o.setName('evidence').setDescription('Evidence URL or message link').setRequired(false));

async function execute(interaction: ChatInputCommandInteraction, app: App): Promise<void> {
  await interaction.deferReply();
  const guild = interaction.guild;
  if (!guild) return;
  const user = await resolveUserOption(interaction, app);
  if (!user) {
    await v2Reply(interaction, 'User not found.', { ephemeral: true });
    return;
  }
  const reason = interaction.options.getString('reason', true);
  const evidence = interaction.options.getString('evidence');
  const result = await app.punishmentManager.warn(user as never, {
    reason,
    moderatorId: interaction.user.id,
    archiveChannelId: interaction.channel?.id ?? null,
    evidence: evidence ? [{ url: evidence }] : undefined,
  });
  if (!result.ok) {
    await v2Reply(interaction, `Failed: ${result.error}`, { ephemeral: true });
    return;
  }
  await v2Reply(interaction, `Warned <@${user.id}> — case ${result.case!.case_code}. DM sent: ${result.dmSent ? 'yes' : 'no (user has DMs closed)'}.`);
}

async function prefixExecute(message: Message, args: string[], app: App): Promise<void> {
  const guild = message.guild;
  if (!guild) {
    await v2MessageReply(message, { content: 'Usage: `!warn <user> <reason>`' });
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
    await v2MessageReply(message, { content: 'Usage: `!warn <user> <reason>` — or reply to a message to warn its author.' });
    return;
  }
  const member = await guild.members.fetch(targetId).catch(() => null);
  if (!member) {
    await v2MessageReply(message, { content: 'User not found in this server.' });
    return;
  }
  const guard = app.modGuard.canModerate(member, message.member!);
  if (!guard.ok) {
    await v2MessageReply(message, { content: `Cannot warn: ${guard.reason}` });
    return;
  }
  const result = await app.punishmentManager.warn(member, { reason, moderatorId: message.author.id, archiveChannelId: message.channel?.id ?? null, evidence });
  if (!result.ok) {
    await v2MessageReply(message, { content: `Failed: ${result.error}` });
    return;
  }
  await v2MessageReply(message, { content: `Warned <@${targetId}> — case ${result.case!.case_code}.` });
}

const command: BotCommand = {
  name: 'warn',
  category: 'moderation',
  description: 'Warn a user (creates a formal case)',
  data,
  permissions: ['ModerateMembers'],
  aliases: ['w', 'warning'],
  execute,
  prefixExecute,
};

export default command;