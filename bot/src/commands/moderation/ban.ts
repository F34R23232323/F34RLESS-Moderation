import { SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction, Message } from 'discord.js';
import type { App } from '../../core/context';
import type { BotCommand } from '../../types/command';
import { v2Reply } from '../../utils/v2';
import { resolveUserOption } from '../../utils/discord';
import { parseDuration, humanizeDuration } from '../../../../shared/src/index';
import { v2MessageReply } from '../../utils/v2';
import { resolveReplyContext, type CaseEvidenceItem } from '../../utils/evidence';
import { buildConfirmEmbed, storePendingAction } from '../../components/moderation';

const data = new SlashCommandBuilder()
  .setName('ban')
  .setDescription('Ban a user (optionally temporary)')
  .addUserOption((o) => o.setName('user').setDescription('Target user').setRequired(true))
  .addStringOption((o) => o.setName('reason').setDescription('Reason').setRequired(false))
  .addStringOption((o) => o.setName('duration').setDescription('Optional temporary ban, e.g. 7d').setRequired(false))
  .addIntegerOption((o) => o.setName('delete_days').setDescription('Days of messages to delete').setMinValue(0).setMaxValue(7).setRequired(false));

async function execute(interaction: ChatInputCommandInteraction, app: App): Promise<void> {
  await interaction.deferReply({ ephemeral: true });
  const guild = interaction.guild;
  if (!guild) return;
  const user = await resolveUserOption(interaction, app);
  if (!user) {
    await v2Reply(interaction, 'User not found.', { ephemeral: true });
    return;
  }
  const member = await guild.members.fetch(user.id).catch(() => null);
  if (member && interaction.member) {
    const guard = app.modGuard.canModerate(member, interaction.member as never);
    if (!guard.ok) {
      await v2Reply(interaction, `Cannot ban: ${guard.reason}`, { ephemeral: true });
      return;
    }
  }
  const reason = interaction.options.getString('reason') ?? 'No reason provided';
  const durationStr = interaction.options.getString('duration');
  const durationMs = durationStr ? (parseDuration(durationStr)?.milliseconds ?? 0) : 0;
  const deleteDays = interaction.options.getInteger('delete_days') ?? 0;

  const actionId = storePendingAction({
    action: 'ban', targetUserId: user.id, guildId: guild.id, channelId: interaction.channelId,
    reason, durationMs: durationMs > 0 ? durationMs : undefined, deleteDays: deleteDays || undefined,
    actorId: interaction.user.id, expiresAt: Date.now() + 60_000,
  });
  const { components, flags } = buildConfirmEmbed('Ban', user.id, reason, durationMs > 0 ? durationMs : undefined);
  await interaction.editReply({ content: '', components, flags } as never);
}

async function prefixExecute(message: Message, args: string[], app: App): Promise<void> {
  const guild = message.guild;
  if (!guild) {
    await v2MessageReply(message, { content: 'Usage: `!ban <user> [duration] <reason>`' });
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
  if (!targetId) {
    await v2MessageReply(message, { content: 'Usage: `!ban <user> [duration] <reason>` — or reply to a message to ban its author.' });
    return;
  }
  const durationMs = durationStr ? (parseDuration(durationStr)?.milliseconds ?? 0) : 0;

  const actionId = storePendingAction({
    action: 'ban', targetUserId: targetId, guildId: guild.id, channelId: message.channelId,
    reason, durationMs: durationMs > 0 ? durationMs : undefined,
    actorId: message.author.id, expiresAt: Date.now() + 60_000,
  });
  const durLine = durationMs > 0 ? ` for ${humanizeDuration(durationMs)}` : '';
  const sent = await v2MessageReply(message, { content: `⚠️ **Confirm ban** <@${targetId}>${durLine} — reason: ${reason}\nReact with ✅ to confirm, ❌ to cancel.` });
  await sent.react('✅').catch(() => undefined);
  await sent.react('❌').catch(() => undefined);

  const collector = sent.createReactionCollector({
    filter: (r, u) => (r.emoji.name === '✅' || r.emoji.name === '❌') && u.id === message.author.id,
    time: 30_000, max: 1,
  });
  collector.on('end', async (collected) => {
    await sent.delete().catch(() => undefined);
    if (collected.first()?.emoji.name !== '✅') { await v2MessageReply(message, { content: 'Ban cancelled.' }); return; }
    const result = await app.punishmentManager.ban(targetId as never, { reason, moderatorId: message.author.id, archiveChannelId: message.channel?.id ?? null, durationMs: durationMs > 0 ? durationMs : undefined, evidence });
    const dur = durationMs > 0 ? ` for ${humanizeDuration(durationMs)}` : '';
    await v2MessageReply(message, { content: result.ok ? `Banned <@${targetId}>${dur} — case ${result.case!.case_code}.` : `Failed: ${result.error}` });
  });
}

const command: BotCommand = {
  name: 'ban',
  category: 'moderation',
  description: 'Ban a user (optionally temporary)',
  data,
  permissions: ['BanMembers'],
  aliases: ['b', 'bann'],
  execute,
  prefixExecute,
};

export default command;