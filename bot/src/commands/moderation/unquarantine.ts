import { SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction, Message } from 'discord.js';
import type { RowDataPacket } from 'mysql2/promise';
import { parseJson } from '../../../../shared/src/index';
import type { App } from '../../core/context';
import type { BotCommand } from '../../types/command';
import { v2Reply } from '../../utils/v2';
import { resolveUserOption } from '../../utils/discord';
import { v2MessageReply } from '../../utils/v2';

const data = new SlashCommandBuilder()
  .setName('unquarantine')
  .setDescription('Restore a quarantined user to their original roles')
  .addUserOption((o) => o.setName('user').setDescription('Target user').setRequired(true));

async function execute(interaction: ChatInputCommandInteraction, app: App): Promise<void> {
  await interaction.deferReply();
  const guild = interaction.guild;
  if (!guild) return;
  const user = await resolveUserOption(interaction, app);
  if (!user) {
    await v2Reply(interaction, 'User not found.', { ephemeral: true });
    return;
  }
  const [rows] = await app.db.query<RowDataPacket[]>(
    'SELECT original_roles FROM quarantines WHERE guild_id = ? AND user_id = ? AND active = 1',
    [guild.id, user.id],
  );
  const row = rows[0] as { original_roles?: string } | undefined;
  if (!row) {
    await v2Reply(interaction, 'User is not quarantined.', { ephemeral: true });
    return;
  }
  const member = await guild.members.fetch(user.id).catch(() => null);
  const roles = parseJson(row.original_roles, []) as string[];
  if (member) {
    await member.roles.set([...roles, guild.id], 'Quarantine lifted').catch(() => undefined);
  }
  await app.db.execute('UPDATE quarantines SET active = 0 WHERE guild_id = ? AND user_id = ?', [guild.id, user.id]);
  await v2Reply(interaction, `Restored <@${user.id}>'s roles.`);
}

async function prefixExecute(message: Message, args: string[], app: App): Promise<void> {
  const guild = message.guild;
  const targetId = args[0]?.replace(/[<@!>]/g, '');
  if (!guild || !targetId) {
    await v2MessageReply(message, { content: 'Usage: `!unquarantine <user>`' });
    return;
  }
  const [rows] = await app.db.query<RowDataPacket[]>(
    'SELECT original_roles FROM quarantines WHERE guild_id = ? AND user_id = ? AND active = 1',
    [guild.id, targetId],
  );
  const row = rows[0] as { original_roles?: string } | undefined;
  if (!row) {
    await v2MessageReply(message, { content: 'User is not quarantined.' });
    return;
  }
  const member = await guild.members.fetch(targetId).catch(() => null);
  const roles = parseJson(row.original_roles, []) as string[];
  if (member) await member.roles.set([...roles, guild.id], 'Quarantine lifted').catch(() => undefined);
  await app.db.execute('UPDATE quarantines SET active = 0 WHERE guild_id = ? AND user_id = ?', [guild.id, targetId]);
  await v2MessageReply(message, { content: `Restored <@${targetId}>'s roles.` });
}

const command: BotCommand = {
  name: 'unquarantine',
  category: 'moderation',
  description: 'Restore a quarantined user to their original roles',
  data,
  permissions: ['ModerateMembers'],
  aliases: ['uq'],
  execute,
  prefixExecute,
};

export default command;