import { SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction, Message } from 'discord.js';
import type { App } from '../../core/context';
import type { BotCommand } from '../../types/command';
import { v2Reply } from '../../utils/v2';
import { resolveUserOption } from '../../utils/discord';
import { v2MessageReply } from '../../utils/v2';

const data = new SlashCommandBuilder()
  .setName('softban')
  .setDescription('Ban and immediately unban to purge messages')
  .addUserOption((o) => o.setName('user').setDescription('Target user').setRequired(true))
  .addStringOption((o) => o.setName('reason').setDescription('Reason').setRequired(false))
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
      await v2Reply(interaction, `Cannot softban: ${guard.reason}`, { ephemeral: true });
      return;
    }
  }
  const reason = interaction.options.getString('reason') ?? 'No reason provided';
  const deleteDays = interaction.options.getInteger('delete_days') ?? 7;
  const result = await app.punishmentManager.softban(user as never, { reason, moderatorId: interaction.user.id, archiveChannelId: interaction.channel?.id ?? null, deleteMessageDays: deleteDays });
  if (!result.ok) {
    await v2Reply(interaction, `Failed: ${result.error}`, { ephemeral: true });
    return;
  }
  await v2Reply(interaction, `Softbanned <@${user.id}> — case ${result.case!.case_code}.`);
}

async function prefixExecute(message: Message, args: string[], app: App): Promise<void> {
  const guild = message.guild;
  const targetId = args[0]?.replace(/[<@!>]/g, '');
  const reason = args.slice(1).join(' ') || 'No reason provided';
  if (!guild || !targetId) {
    await v2MessageReply(message, { content: 'Usage: `!softban <user> <reason>`' });
    return;
  }
  const result = await app.punishmentManager.softban(targetId as never, { reason, moderatorId: message.author.id, archiveChannelId: message.channel?.id ?? null });
  await v2MessageReply(message, { content: result.ok ? `Softbanned <@${targetId}> — case ${result.case!.case_code}.` : `Failed: ${result.error}` });
}

const command: BotCommand = {
  name: 'softban',
  category: 'moderation',
  description: 'Ban and immediately unban to purge messages',
  data,
  permissions: ['BanMembers'],
  aliases: ['sb'],
  execute,
  prefixExecute,
};

export default command;