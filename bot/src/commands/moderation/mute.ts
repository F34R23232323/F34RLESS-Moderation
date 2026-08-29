import { SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction, Message } from 'discord.js';
import type { App } from '../../core/context';
import type { BotCommand } from '../../types/command';
import { v2Reply } from '../../utils/v2';
import { resolveMemberOption } from '../../utils/discord';
import { parseDuration, humanizeDuration } from '../../../../shared/src/index';
import { v2MessageReply } from '../../utils/v2';
import { resolveReplyContext, type CaseEvidenceItem } from '../../utils/evidence';
import { buildConfirmEmbed, storePendingAction } from '../../components/moderation';

const data = new SlashCommandBuilder()
  .setName('mute')
  .setDescription('Mute (timeout) a user')
  .addUserOption((o) => o.setName('user').setDescription('Target user').setRequired(true))
  .addStringOption((o) => o.setName('duration').setDescription('Duration like 10m, 2h, 14d').setRequired(true))
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
  if (!guard.ok) { await v2Reply(interaction, `Cannot mute: ${guard.reason}`, { ephemeral: true }); return; }
  const duration = parseDuration(interaction.options.getString('duration', true));
  if (!duration || duration.isPermanent) {
    await v2Reply(interaction, 'Provide a valid duration (e.g. 10m, 2h, 14d).', { ephemeral: true });
    return;
  }
  const reason = interaction.options.getString('reason') ?? 'No reason provided';
  storePendingAction({ action: 'mute', targetUserId: resolved.user.id, guildId: guild.id, channelId: interaction.channelId, reason, durationMs: duration.milliseconds, actorId: interaction.user.id, expiresAt: Date.now() + 60_000 });
  const { components, flags } = buildConfirmEmbed('Mute', resolved.user.id, reason, duration.milliseconds);
  await interaction.editReply({ content: '', components, flags } as never);
}

async function prefixExecute(message: Message, args: string[], app: App): Promise<void> {
  const guild = message.guild;
  if (!guild) { await v2MessageReply(message, { content: 'Usage: `!mute <user> <duration> <reason>`' }); return; }
  const replyCtx = await resolveReplyContext(message);
  let targetId = args[0]?.replace(/[<@!>]/g, '');
  let durationStr = args[1];
  let reason = args.slice(2).join(' ') || 'No reason provided';
  let evidence: CaseEvidenceItem[] | undefined;
  if (!targetId && replyCtx) { targetId = replyCtx.targetId; durationStr = args[0]; reason = args.slice(1).join(' ') || 'No reason provided'; evidence = replyCtx.evidence; }
  if (!targetId || !durationStr) { await v2MessageReply(message, { content: 'Usage: `!mute <user> <duration> <reason>` — or reply to a message to mute its author.' }); return; }
  const member = await guild.members.fetch(targetId).catch(() => null);
  if (!member) { await v2MessageReply(message, { content: 'User not found.' }); return; }
  const guard = app.modGuard.canModerate(member, message.member!);
  if (!guard.ok) { await v2MessageReply(message, { content: `Cannot mute: ${guard.reason}` }); return; }
  const duration = parseDuration(durationStr);
  if (!duration || duration.isPermanent) { await v2MessageReply(message, { content: 'Provide a valid duration (e.g. 10m, 2h, 14d).' }); return; }
  storePendingAction({ action: 'mute', targetUserId: targetId, guildId: guild.id, channelId: message.channelId, reason, durationMs: duration.milliseconds, actorId: message.author.id, expiresAt: Date.now() + 60_000 });
  const durStr = humanizeDuration(duration.milliseconds);
  const sent = await v2MessageReply(message, { content: `⚠️ **Confirm mute** <@${targetId}> for ${durStr} — reason: ${reason}\nReact with ✅ to confirm, ❌ to cancel.` });
  await sent.react('✅').catch(() => undefined);
  await sent.react('❌').catch(() => undefined);
  const collector = sent.createReactionCollector({ filter: (r, u) => (r.emoji.name === '✅' || r.emoji.name === '❌') && u.id === message.author.id, time: 30_000, max: 1 });
  collector.on('end', async (collected) => {
    await sent.delete().catch(() => undefined);
    if (collected.first()?.emoji.name !== '✅') { await v2MessageReply(message, { content: 'Mute cancelled.' }); return; }
    const result = await app.punishmentManager.timeout(member, duration.milliseconds, { reason, moderatorId: message.author.id, archiveChannelId: message.channel?.id ?? null, logEvent: 'member_mute', evidence });
    await v2MessageReply(message, { content: result.ok ? `Muted <@${targetId}> for ${durStr} — case ${result.case!.case_code}.` : `Failed: ${result.error}` });
  });
}

const command: BotCommand = {
  name: 'mute', category: 'moderation', description: 'Mute (timeout) a user',
  data, permissions: ['ModerateMembers'], aliases: ['m', 'tempmute', 'tmute'], execute, prefixExecute,
};

export default command;