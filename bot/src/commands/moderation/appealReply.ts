import { SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction } from 'discord.js';
import type { RowDataPacket } from 'mysql2/promise';
import type { App } from '../../core/context';
import type { BotCommand } from '../../types/command';
import { v2Reply } from '../../utils/v2';
import { isAppealsStaff } from '../../services/appealService';

// Staff-only: reply to an appeal's chat from inside Discord (guild thread or
// DM). The message lands in appeal_messages (picked up by the WS-pushed web
// chat) and is relayed into the Discord thread if one exists.
const data = new SlashCommandBuilder()
  .setName('appeal-reply')
  .setDescription('Reply to an appeal from Discord (staff only)')
  .addIntegerOption((o) => o.setName('appeal_id').setDescription('The appeal ID (shown on the appeal card)').setRequired(true).setMinValue(1))
  .addStringOption((o) => o.setName('message').setDescription('Reply to the appellant').setRequired(true).setMaxLength(2000));

async function execute(interaction: ChatInputCommandInteraction, app: App): Promise<void> {
  const appealId = interaction.options.getInteger('appeal_id', true);
  const content = interaction.options.getString('message', true).trim();
  if (!content) {
    await v2Reply(interaction, 'The message cannot be empty.', { ephemeral: true });
    return;
  }

  const guildId = interaction.guildId;
  if (!guildId) {
    await v2Reply(interaction, 'This command must be run in a server.', { ephemeral: true });
    return;
  }
  const guild = app.client.guilds.cache.get(guildId);
  if (!guild) {
    await v2Reply(interaction, 'Guild not found.', { ephemeral: true });
    return;
  }

  // Staff check — resolve a real GuildMember (interaction member in guild
  // context, fresh fetch in DM context).
  const member =
    interaction.guild && interaction.member && 'roles' in interaction.member
      ? (interaction.member as never)
      : await guild.members.fetch(interaction.user.id).catch(() => null);
  if (!isAppealsStaff(app, { guild, member: member as never })) {
    await v2Reply(interaction, 'You do not have permission to reply to appeals.', { ephemeral: true });
    return;
  }

  const [rows] = await app.db.query<RowDataPacket[]>(
    'SELECT id, guild_id, user_id, status, discord_thread_id FROM appeals WHERE id = ? AND guild_id = ?',
    [appealId, guild.id],
  );
  const appeal = rows[0] as { id: number; guild_id: string; user_id: string; status: string; discord_thread_id: string | null } | undefined;
  if (!appeal) {
    await v2Reply(interaction, `Appeal #${appealId} not found in this server.`, { ephemeral: true });
    return;
  }

  const [insertResult] = await app.db.execute(
    "INSERT INTO appeal_messages (appeal_id, sender_type, sender_id, content) VALUES (?, 'staff', ?, ?)",
    [appeal.id, interaction.user.id, content],
  );
  const messageId = (insertResult as { insertId: number }).insertId;

  // Relay into the Discord thread + DM the appellant (pending appeals only).
  await app.appeals.relayStaffMessage(appeal.id, messageId).catch((err) => {
    app.logger.warn(`appeal-reply relay for appeal #${appeal.id} failed:`, err);
  });

  await v2Reply(interaction, `Reply added to appeal #${appeal.id}.`, { ephemeral: true });
}

const command: BotCommand = {
  name: 'appeal-reply',
  category: 'moderation',
  description: 'Reply to an appeal from Discord (staff only)',
  data,
  permissions: [],
  aliases: [],
  execute,
};

export default command;
