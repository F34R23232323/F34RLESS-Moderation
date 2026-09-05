import { SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction, Message } from 'discord.js';
import type { App } from '../../core/context';
import type { BotCommand } from '../../types/command';
import { v2Reply } from '../../utils/v2';
import { resolveMemberOption } from '../../utils/discord';
import { v2MessageReply } from '../../utils/v2';
import { parseTargetId, mapDiscordError } from '../../utils/moderationErrors';

const data = new SlashCommandBuilder()
  .setName('unmute')
  .setDescription('Remove a mute/timeout from a user')
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
  const reason = interaction.options.getString('reason') ?? 'Mute lifted';
  const result = await app.punishmentManager.unmute(resolved.member, { reason, moderatorId: interaction.user.id });
  if (!result.ok) {
    await v2Reply(interaction, `Failed: ${mapDiscordError(result.error!)}`, { ephemeral: true });
    return;
  }
  await v2Reply(interaction, `Unmuted <@${resolved.user!.id}> — case ${result.case!.case_code}.`);
}

async function prefixExecute(message: Message, args: string[], app: App): Promise<void> {
  const guild = message.guild;
  const targetId = parseTargetId(args[0]);
  const reason = args.slice(1).join(' ') || 'Mute lifted';
  if (!guild || !targetId) {
    await v2MessageReply(message, { content: 'Usage: `!unmute <user> <reason>`' });
    return;
  }
  const member = await guild.members.fetch(targetId).catch(() => null);
  if (!member) {
    await v2MessageReply(message, { content: 'User not found in this server.' });
    return;
  }
  const result = await app.punishmentManager.unmute(member, { reason, moderatorId: message.author.id });
  await v2MessageReply(message, { content: result.ok ? `Unmuted <@${targetId}> — case ${result.case!.case_code}.` : `Failed: ${mapDiscordError(result.error!)}` });
}

const command: BotCommand = {
  name: 'unmute',
  category: 'moderation',
  description: 'Remove a mute/timeout from a user',
  data,
  permissions: ['ModerateMembers'],
  aliases: ['um'],
  execute,
  prefixExecute,
};

export default command;