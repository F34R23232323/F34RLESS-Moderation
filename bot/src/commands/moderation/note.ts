import { SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction, Message } from 'discord.js';
import type { App } from '../../core/context';
import type { BotCommand } from '../../types/command';
import { v2Reply } from '../../utils/v2';
import { resolveUserOption } from '../../utils/discord';
import { v2MessageReply } from '../../utils/v2';
import { parseTargetId } from '../../utils/moderationErrors';

const data = new SlashCommandBuilder()
  .setName('note')
  .setDescription('Add a staff note to a user (not a punishment)')
  .addUserOption((o) => o.setName('user').setDescription('Target user').setRequired(true))
  .addStringOption((o) => o.setName('note').setDescription('Note content').setRequired(true));

async function execute(interaction: ChatInputCommandInteraction, app: App): Promise<void> {
  const guild = interaction.guild;
  if (!guild) return;
  const user = await resolveUserOption(interaction, app);
  const note = interaction.options.getString('note', true);
  if (!user) {
    await v2Reply(interaction, 'User not found.', { ephemeral: true });
    return;
  }
  await app.db.execute(
    'INSERT INTO notes (guild_id, user_id, moderator_id, note) VALUES (?, ?, ?, ?)',
    [guild.id, user.id, interaction.user.id, note],
  );
  await v2Reply(interaction, `Note added to <@${user.id}>.`, { ephemeral: true });
}

async function prefixExecute(message: Message, args: string[], app: App): Promise<void> {
  const guild = message.guild;
  const targetId = parseTargetId(args[0]);
  const note = args.slice(1).join(' ');
  if (!guild || !targetId || !note) {
    await v2MessageReply(message, { content: 'Usage: `!note <user> <note>`' });
    return;
  }
  await app.db.execute(
    'INSERT INTO notes (guild_id, user_id, moderator_id, note) VALUES (?, ?, ?, ?)',
    [guild.id, targetId, message.author.id, note],
  );
  await v2MessageReply(message, { content: `Note added to <@${targetId}>.` });
}

const command: BotCommand = {
  name: 'note',
  category: 'moderation',
  description: 'Add a staff note to a user (not a punishment)',
  data,
  permissions: ['ModerateMembers'],
  aliases: [],
  execute,
  prefixExecute,
};

export default command;