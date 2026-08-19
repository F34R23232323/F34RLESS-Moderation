import { SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction, Message } from 'discord.js';
import type { App } from '../../core/context';
import type { BotCommand } from '../../types/command';
import { v2Reply } from '../../utils/v2';
import { resolveMemberOption } from '../../utils/discord';
import { parseDuration, humanizeDuration } from '../../../../shared/src/index';
import { v2MessageReply } from '../../utils/v2';

const data = new SlashCommandBuilder()
  .setName('mute')
  .setDescription('Mute (timeout) a user')
  .addUserOption((o) => o.setName('user').setDescription('Target user').setRequired(true))
  .addStringOption((o) => o.setName('duration').setDescription('Duration like 10m, 2h, 14d').setRequired(true))
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
    await v2Reply(interaction, `Cannot mute: ${guard.reason}`, { ephemeral: true });
    return;
  }
  const duration = parseDuration(interaction.options.getString('duration', true));
  if (!duration || duration.isPermanent) {
    await v2Reply(interaction, 'Provide a valid duration (e.g. 10m, 2h, 14d).', { ephemeral: true });
    return;
  }
  const reason = interaction.options.getString('reason') ?? 'No reason provided';
  const result = await app.punishmentManager.timeout(resolved.member, duration.milliseconds, {
    reason,
    moderatorId: interaction.user.id,
    archiveChannelId: interaction.channel?.id ?? null,
    logEvent: 'member_mute',
  });
  if (!result.ok) {
    await v2Reply(interaction, `Failed: ${result.error}`, { ephemeral: true });
    return;
  }
  await v2Reply(interaction, `Muted <@${resolved.user!.id}> for ${humanizeDuration(duration.milliseconds)} — case ${result.case!.case_code}.`);
}

async function prefixExecute(message: Message, args: string[], app: App): Promise<void> {
  const guild = message.guild;
  const targetId = args[0]?.replace(/[<@!>]/g, '');
  const durationStr = args[1];
  const reason = args.slice(2).join(' ') || 'No reason provided';
  if (!guild || !targetId || !durationStr) {
    await v2MessageReply(message, { content: 'Usage: `!mute <user> <duration> <reason>`' });
    return;
  }
  const member = await guild.members.fetch(targetId).catch(() => null);
  if (!member) {
    await v2MessageReply(message, { content: 'User not found.' });
    return;
  }
  const guard = app.modGuard.canModerate(member, message.member!);
  if (!guard.ok) {
    await v2MessageReply(message, { content: `Cannot mute: ${guard.reason}` });
    return;
  }
  const duration = parseDuration(durationStr);
  if (!duration || duration.isPermanent) {
    await v2MessageReply(message, { content: 'Provide a valid duration (e.g. 10m, 2h, 14d).' });
    return;
  }
  const result = await app.punishmentManager.timeout(member, duration.milliseconds, { reason, moderatorId: message.author.id, archiveChannelId: message.channel?.id ?? null, logEvent: 'member_mute' });
  await v2MessageReply(message, { content: result.ok ? `Muted <@${targetId}> for ${humanizeDuration(duration.milliseconds)} — case ${result.case!.case_code}.` : `Failed: ${result.error}` });
}

const command: BotCommand = {
  name: 'mute',
  category: 'moderation',
  description: 'Mute (timeout) a user',
  data,
  permissions: ['ModerateMembers'],
  aliases: ['m', 'tempmute', 'tmute'],
  execute,
  prefixExecute,
};

export default command;