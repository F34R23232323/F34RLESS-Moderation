import { SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction, Message } from 'discord.js';
import type { App } from '../../core/context';
import type { BotCommand } from '../../types/command';
import { v2Reply } from '../../utils/v2';
import { resolveUserOption } from '../../utils/discord';
import { v2MessageReply } from '../../utils/v2';
import { parseTargetId, mapDiscordError } from '../../utils/moderationErrors';

const data = new SlashCommandBuilder()
  .setName('unban')
  .setDescription('Unban a user')
  .addUserOption((o) => o.setName('user').setDescription('Target user').setRequired(true))
  .addStringOption((o) => o.setName('reason').setDescription('Reason').setRequired(false));

async function execute(interaction: ChatInputCommandInteraction, app: App): Promise<void> {
  await interaction.deferReply();
  const guild = interaction.guild;
  if (!guild) return;
  const user = await resolveUserOption(interaction, app);
  if (!user) {
    await v2Reply(interaction, 'User not found.', { ephemeral: true });
    return;
  }
  const reason = interaction.options.getString('reason') ?? 'No reason provided';
  const result = await app.punishmentManager.unban(guild, user.id, { reason, moderatorId: interaction.user.id });
  if (!result.ok) {
    await v2Reply(interaction, `Failed: ${mapDiscordError(result.error!)}`, { ephemeral: true });
    return;
  }
  await v2Reply(interaction, `Unbanned <@${user.id}> — case ${result.case!.case_code}.`);
}

async function prefixExecute(message: Message, args: string[], app: App): Promise<void> {
  const guild = message.guild;
  const targetId = parseTargetId(args[0]);
  const reason = args.slice(1).join(' ') || 'No reason provided';
  if (!guild || !targetId) {
    await v2MessageReply(message, { content: 'Usage: `!unban <user> <reason>`' });
    return;
  }
  const result = await app.punishmentManager.unban(guild, targetId, { reason, moderatorId: message.author.id });
  await v2MessageReply(message, { content: result.ok ? `Unbanned <@${targetId}> — case ${result.case!.case_code}.` : `Failed: ${mapDiscordError(result.error!)}` });
}

const command: BotCommand = {
  name: 'unban',
  category: 'moderation',
  description: 'Unban a user',
  data,
  permissions: ['BanMembers'],
  aliases: [],
  execute,
  prefixExecute,
};

export default command;