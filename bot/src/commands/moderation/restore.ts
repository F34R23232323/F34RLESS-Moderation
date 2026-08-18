import { SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction, Message } from 'discord.js';
import type { RowDataPacket } from 'mysql2/promise';
import { parseJson } from '../../../../shared/src/index';
import type { App } from '../../core/context';
import type { BotCommand } from '../../types/command';
import { v2Reply } from '../../utils/v2';
import { resolveUserOption } from '../../utils/discord';

const data = new SlashCommandBuilder()
  .setName('restore')
  .setDescription('Restore a member from the latest snapshot')
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
    'SELECT roles, nickname FROM member_snapshots WHERE guild_id = ? AND user_id = ? ORDER BY id DESC LIMIT 1',
    [guild.id, user.id],
  );
  const row = rows[0] as { roles?: string; nickname?: string } | undefined;
  if (!row) {
    await v2Reply(interaction, 'No snapshot found for this user.', { ephemeral: true });
    return;
  }
  const member = await guild.members.fetch(user.id).catch(() => null);
  if (!member) {
    await v2Reply(interaction, 'User is not in the server.', { ephemeral: true });
    return;
  }
  const roles = parseJson(row.roles, []) as string[];
  await member.roles.set([...roles, guild.id], 'Snapshot restore');
  if (row.nickname) await member.setNickname(row.nickname, 'Snapshot restore').catch(() => undefined);
  await v2Reply(interaction, `Restored <@${user.id}> from snapshot (${roles.length} roles).`);
}

async function prefixExecute(message: Message, args: string[], app: App): Promise<void> {
  const guild = message.guild;
  const targetId = args[0]?.replace(/[<@!>]/g, '');
  if (!guild || !targetId) {
    await message.reply({ content: 'Usage: `!restore <user>`' });
    return;
  }
  const [rows] = await app.db.query<RowDataPacket[]>(
    'SELECT roles, nickname FROM member_snapshots WHERE guild_id = ? AND user_id = ? ORDER BY id DESC LIMIT 1',
    [guild.id, targetId],
  );
  const row = rows[0] as { roles?: string; nickname?: string } | undefined;
  if (!row) {
    await message.reply({ content: 'No snapshot found.' });
    return;
  }
  const member = await guild.members.fetch(targetId).catch(() => null);
  if (!member) {
    await message.reply({ content: 'User not in server.' });
    return;
  }
  const roles = parseJson(row.roles, []) as string[];
  await member.roles.set([...roles, guild.id], 'Snapshot restore');
  await message.reply({ content: `Restored <@${targetId}> from snapshot.` });
}

const command: BotCommand = {
  name: 'restore',
  category: 'moderation',
  description: 'Restore a member from the latest snapshot',
  data,
  permissions: ['ModerateMembers'],
  aliases: [],
  execute,
  prefixExecute,
};

export default command;