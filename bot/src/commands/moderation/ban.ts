import { SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction, Message } from 'discord.js';
import type { App } from '../../core/context';
import type { BotCommand } from '../../types/command';
import { v2Reply } from '../../utils/v2';
import { resolveUserOption } from '../../utils/discord';
import { parseDuration, humanizeDuration } from '../../../../shared/src/index';

const data = new SlashCommandBuilder()
  .setName('ban')
  .setDescription('Ban a user (optionally temporary)')
  .addUserOption((o) => o.setName('user').setDescription('Target user').setRequired(true))
  .addStringOption((o) => o.setName('reason').setDescription('Reason').setRequired(false))
  .addStringOption((o) => o.setName('duration').setDescription('Optional temporary ban, e.g. 7d').setRequired(false))
  .addIntegerOption((o) => o.setName('delete_days').setDescription('Days of messages to delete').setMinValue(0).setMaxValue(7).setRequired(false));

async function execute(interaction: ChatInputCommandInteraction, app: App): Promise<void> {
  await interaction.deferReply();
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
  const result = await app.punishmentManager.ban(user as never, {
    reason,
    moderatorId: interaction.user.id,
    durationMs: durationMs > 0 ? durationMs : undefined,
    deleteMessageDays: deleteDays,
  });
  if (!result.ok) {
    await v2Reply(interaction, `Failed: ${result.error}`, { ephemeral: true });
    return;
  }
  const dur = durationMs > 0 ? ` for ${humanizeDuration(durationMs)}` : '';
  await v2Reply(interaction, `Banned <@${user.id}>${dur} — case ${result.case!.case_code}.`);
}

async function prefixExecute(message: Message, args: string[], app: App): Promise<void> {
  const guild = message.guild;
  const targetId = args[0]?.replace(/[<@!>]/g, '');
  const durationStr = args[1];
  const reason = args.slice(2).join(' ') || 'No reason provided';
  if (!guild || !targetId) {
    await message.reply({ content: 'Usage: `!ban <user> [duration] <reason>`' });
    return;
  }
  const durationMs = durationStr ? (parseDuration(durationStr)?.milliseconds ?? 0) : 0;
  const result = await app.punishmentManager.ban(targetId as never, {
    reason,
    moderatorId: message.author.id,
    durationMs: durationMs > 0 ? durationMs : undefined,
  });
  await message.reply({ content: result.ok ? `Banned <@${targetId}> — case ${result.case!.case_code}.` : `Failed: ${result.error}` });
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