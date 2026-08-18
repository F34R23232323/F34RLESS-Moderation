import { SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction, Message } from 'discord.js';
import type { RowDataPacket } from 'mysql2/promise';
import type { App } from '../../core/context';
import type { BotCommand } from '../../types/command';
import { v2Reply } from '../../utils/v2';
import { resolveUserOption } from '../../utils/discord';
import { snowflakeToDate } from '../../../../shared/src/index';

const data = new SlashCommandBuilder()
  .setName('lookup')
  .setDescription('Full user lookup, or decode a snowflake')
  .addSubcommand((s) => s.setName('user').setDescription('Full user lookup').addUserOption((o) => o.setName('user').setDescription('Target user').setRequired(true)))
  .addSubcommand((s) => s.setName('snowflake').setDescription('Decode a Discord ID into a timestamp').addStringOption((o) => o.setName('id').setDescription('Snowflake ID').setRequired(true)));

async function execute(interaction: ChatInputCommandInteraction, app: App): Promise<void> {
  await interaction.deferReply();
  const guild = interaction.guild;
  if (!guild) return;
  const sub = interaction.options.getSubcommand();
  if (sub === 'snowflake') {
    const id = interaction.options.getString('id', true);
    const date = snowflakeToDate(id);
    if (!date) {
      await v2Reply(interaction, `\`${id}\` is not a valid snowflake.`, { ephemeral: true });
      return;
    }
    const ts = Math.floor(date.getTime() / 1000);
    await v2Reply(interaction, [
      `**Snowflake: ${id}**`,
      `Created: <t:${ts}:F>`,
      `Relative: <t:${ts}:R>`,
    ].join('\n'));
    return;
  }
  const user = interaction.options.getUser('user') ?? (await resolveUserOption(interaction, app));
  if (!user) {
    await v2Reply(interaction, 'User not found.', { ephemeral: true });
    return;
  }
  const member = await guild.members.fetch(user.id).catch(() => null);

  const [cases, notes, warnings, triggers, risk] = await Promise.all([
    app.caseService.listCasesForUser(guild.id, user.id),
    app.db.query<RowDataPacket[]>('SELECT note, created_at FROM notes WHERE guild_id = ? AND user_id = ? ORDER BY created_at DESC LIMIT 10', [guild.id, user.id]),
    app.db.query<RowDataPacket[]>('SELECT COUNT(*) AS count FROM warnings WHERE guild_id = ? AND user_id = ? AND active = 1', [guild.id, user.id]),
    app.db.query<RowDataPacket[]>('SELECT rule, module, created_at FROM automod_triggers WHERE guild_id = ? AND user_id = ? ORDER BY created_at DESC LIMIT 10', [guild.id, user.id]),
    app.db.query<RowDataPacket[]>('SELECT score FROM risk_scores WHERE guild_id = ? AND user_id = ?', [guild.id, user.id]),
  ]);

  const joined = member?.joinedAt ? `Joined: ${member.joinedAt.toISOString()}` : 'Joined: not in server';
  const accountAge = Math.round((Date.now() - user.createdTimestamp) / 86400000);
  const warnCount = Number(warnings[0][0]?.count ?? 0);
  const riskScore = risk[0][0]?.score ?? 0;
  const noteRows = notes[0] as Array<{ note: string; created_at: Date }>;
  const triggerRows = triggers[0] as Array<{ rule: string; module: string; created_at: Date }>;

  const lines = [
    `**Lookup: <@${user.id}>**`,
    `Account created: ${user.createdAt.toISOString()} (${accountAge} days ago)`,
    joined,
    `Roles: ${member ? member.roles.cache.filter((r) => r.id !== guild.id).map((r) => `<@&${r.id}>`).join(' ') || 'none' : 'n/a'}`,
    `Warning count: ${warnCount} | Risk score: ${riskScore}`,
    `Cases: ${cases.length}`,
    '',
    '**Notes**',
    noteRows.length ? noteRows.slice(0, 5).map((n) => `- ${n.note} (${new Date(n.created_at).toLocaleDateString()})`).join('\n') : '- none',
    '',
    '**Recent automod triggers**',
    triggerRows.length ? triggerRows.slice(0, 5).map((t) => `- ${t.module}: ${t.rule} (${new Date(t.created_at).toLocaleString()})`).join('\n') : '- none',
  ];
  await v2Reply(interaction, lines.join('\n'));
}

async function prefixExecute(message: Message, args: string[], app: App): Promise<void> {
  const guild = message.guild;
  const targetId = args[0]?.replace(/[<@!>]/g, '');
  if (!guild || !targetId) {
    await message.reply({ content: 'Usage: `!lookup <user>`' });
    return;
  }
  const user = await app.client.users.fetch(targetId).catch(() => null);
  if (!user) {
    await message.reply({ content: 'User not found.' });
    return;
  }
  const created = snowflakeToDate(user.id);
  await message.reply({ content: `<@${targetId}> account created ${created?.toISOString() ?? 'unknown'}. Run the slash \`/lookup\` for full details.` });
}

const command: BotCommand = {
  name: 'lookup',
  category: 'moderation',
  description: 'Full user lookup: cases, notes, warnings, automod history',
  data,
  permissions: ['ModerateMembers'],
  aliases: ['modlookup'],
  execute,
  prefixExecute,
};

export default command;