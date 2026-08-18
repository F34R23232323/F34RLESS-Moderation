import { SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction, Message } from 'discord.js';
import type { RowDataPacket } from 'mysql2/promise';
import type { App } from '../../core/context';
import type { BotCommand } from '../../types/command';
import { v2Reply } from '../../utils/v2';

const data = new SlashCommandBuilder()
  .setName('level')
  .setDescription('Check your level')
  .addUserOption((o) => o.setName('user').setDescription('Target user').setRequired(false));

async function execute(interaction: ChatInputCommandInteraction, app: App): Promise<void> {
  const guild = interaction.guild;
  if (!guild) return;
  const user = interaction.options.getUser('user') ?? interaction.user;
  const [rows] = await app.db.query<RowDataPacket[]>(
    'SELECT xp, level FROM levels WHERE guild_id = ? AND user_id = ?',
    [guild.id, user.id],
  );
  const row = rows[0];
  if (!row) {
    await v2Reply(interaction, `<@${user.id}> has no XP yet.`);
    return;
  }
  await v2Reply(interaction, `<@${user.id}> — level **${row.level}** (${row.xp} XP)`);
}

const command: BotCommand = {
  name: 'level',
  category: 'community',
  description: 'Check your level',
  data,
  permissions: [],
  aliases: ['rank', 'xp'],
  execute,
};

export default command;