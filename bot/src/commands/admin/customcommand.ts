import { SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction, Message } from 'discord.js';
import { parseJson } from '../../../../shared/src/index';
import type { App } from '../../core/context';
import type { RowDataPacket } from 'mysql2/promise';
import type { BotCommand } from '../../types/command';
import { v2Reply } from '../../utils/v2';

const data = new SlashCommandBuilder()
  .setName('customcommand')
  .setDescription('Manage guild custom commands')
  .addSubcommand((s) => s.setName('add').setDescription('Add a custom command').addStringOption((o) => o.setName('name').setDescription('Command name').setRequired(true)).addStringOption((o) => o.setName('response').setDescription('Response text').setRequired(true)).addStringOption((o) => o.setName('aliases').setDescription('Comma-separated aliases').setRequired(false)))
  .addSubcommand((s) => s.setName('remove').setDescription('Remove a custom command').addStringOption((o) => o.setName('name').setDescription('Command name').setRequired(true)))
  .addSubcommand((s) => s.setName('list').setDescription('List custom commands'));

async function execute(interaction: ChatInputCommandInteraction, app: App): Promise<void> {
  await interaction.deferReply({ ephemeral: true });
  const guild = interaction.guild;
  if (!guild) return;
  const sub = interaction.options.getSubcommand();
  const member = interaction.member as { permissions?: { has: (p: string) => boolean } } | null;
  const isStaff = app.modGuard.isOwner(interaction.user.id) || interaction.user.id === guild.ownerId || (member?.permissions?.has('ManageMessages') ?? false);

  if (sub === 'add') {
    if (!isStaff) {
      await v2Reply(interaction, 'Staff only.', { ephemeral: true });
      return;
    }
    const name = interaction.options.getString('name', true).toLowerCase();
    const response = interaction.options.getString('response', true);
    const aliases = (interaction.options.getString('aliases') ?? '').split(',').map((s) => s.trim()).filter(Boolean);
    await app.db.execute(
      `INSERT INTO custom_commands (guild_id, name, aliases, response) VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE response = VALUES(response), aliases = VALUES(aliases)`,
      [guild.id, name, JSON.stringify(aliases), JSON.stringify({ content: response })],
    );
    await v2Reply(interaction, `Custom command \`${name}\` added.`, { ephemeral: true });
  } else if (sub === 'remove') {
    if (!isStaff) {
      await v2Reply(interaction, 'Staff only.', { ephemeral: true });
      return;
    }
    const name = interaction.options.getString('name', true).toLowerCase();
    await app.db.execute('DELETE FROM custom_commands WHERE guild_id = ? AND name = ?', [guild.id, name]);
    await v2Reply(interaction, `Custom command \`${name}\` removed.`, { ephemeral: true });
  } else if (sub === 'list') {
    const [rows] = await app.db.query<RowDataPacket[]>(
      'SELECT name, aliases FROM custom_commands WHERE guild_id = ? AND enabled = 1 ORDER BY name',
      [guild.id],
    );
    if (rows.length === 0) {
      await v2Reply(interaction, 'No custom commands.', { ephemeral: true });
      return;
    }
    const lines = rows.map((r) => `\`${r.name}\`${r.aliases ? ` (${parseJson(r.aliases, []).join(', ')})` : ''}`);
    await v2Reply(interaction, `**Custom commands**\n${lines.join('\n')}`, { ephemeral: true });
  }
}

const command: BotCommand = {
  name: 'customcommand',
  category: 'admin',
  description: 'Manage guild custom commands',
  data,
  permissions: ['ManageMessages'],
  aliases: ['cc'],
  execute,
};

export default command;