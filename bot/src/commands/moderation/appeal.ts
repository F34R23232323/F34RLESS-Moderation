import { SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction, Message } from 'discord.js';
import type { RowDataPacket } from 'mysql2/promise';
import type { App } from '../../core/context';
import type { BotCommand } from '../../types/command';
import { v2Reply } from '../../utils/v2';
import { v2MessageReply } from '../../utils/v2';

const data = new SlashCommandBuilder()
  .setName('appeal')
  .setDescription('Appeal a punishment case')
  .addStringOption((o) => o.setName('case').setDescription('Case code (shown in your DM) or number').setRequired(true))
  .addStringOption((o) => o.setName('message').setDescription('Appeal message').setRequired(true));

async function execute(interaction: ChatInputCommandInteraction, app: App): Promise<void> {
  await interaction.deferReply({ ephemeral: true });
  const guild = interaction.guild;
  if (!guild) return;
  const rawId = interaction.options.getString('case', true).trim();
  const message = interaction.options.getString('message', true);
  const c = /^\d+$/.test(rawId)
    ? await app.caseService.getCaseByNumber(guild.id, parseInt(rawId, 10))
    : await app.caseService.getCaseByCode(guild.id, rawId);
  if (!c) {
    await v2Reply(interaction, `Case "${rawId}" not found.`, { ephemeral: true });
    return;
  }
  if (c.user_id !== interaction.user.id) {
    await v2Reply(interaction, 'You can only appeal your own cases.', { ephemeral: true });
    return;
  }
  if (c.status !== 'active') {
    await v2Reply(interaction, 'Only active cases can be appealed — this case is closed.', { ephemeral: true });
    return;
  }
  if (c.type === 'kick') {
    await v2Reply(interaction, 'Kick cases cannot be appealed.', { ephemeral: true });
    return;
  }
  const [result] = await app.db.execute(
    'INSERT INTO appeals (case_id, guild_id, user_id, message) VALUES (?, ?, ?, ?)',
    [c.id, guild.id, interaction.user.id, message],
  );
  await app.caseService.setStatus(c.id, 'appealed');
  // Queue the Discord-side card post (same IPC queue the portal uses).
  await app.db.execute(
    "INSERT INTO appeal_actions (guild_id, appeal_id, action) VALUES (?, ?, 'post')",
    [guild.id, (result as { insertId: number }).insertId],
  ).catch(() => undefined);

  await app.logManager.log({
    event: 'appeal_created',
    guildId: guild.id,
    actorId: interaction.user.id,
    targetId: c.user_id,
    message: `Appeal filed for case ${c.case_code}`,
    details: { appealId: (result as { insertId: number }).insertId, message },
  });
  await v2Reply(interaction, `Appeal filed for case ${c.case_code}. Staff will review it.`, { ephemeral: true });
}

async function prefixExecute(message: Message, args: string[], app: App): Promise<void> {
  const rawId = (args[0] ?? '').trim();
  const appeal = args.slice(1).join(' ');
  const guild = message.guild;
  if (!guild || !rawId || !appeal) {
    await v2MessageReply(message, { content: 'Usage: `!appeal <case code or number> <message>`' });
    return;
  }
  const c = /^\d+$/.test(rawId)
    ? await app.caseService.getCaseByNumber(guild.id, parseInt(rawId, 10))
    : await app.caseService.getCaseByCode(guild.id, rawId);
  if (!c || c.user_id !== message.author.id) {
    await v2MessageReply(message, { content: 'Case not found or not yours.' });
    return;
  }
  if (c.status !== 'active') {
    await v2MessageReply(message, { content: 'Only active cases can be appealed — this case is closed.' });
    return;
  }
  if (c.type === 'kick') {
    await v2MessageReply(message, { content: 'Kick cases cannot be appealed.' });
    return;
  }
  const [result] = await app.db.execute('INSERT INTO appeals (case_id, guild_id, user_id, message) VALUES (?, ?, ?, ?)', [c.id, guild.id, message.author.id, appeal]);
  await app.caseService.setStatus(c.id, 'appealed');
  await app.db.execute(
    "INSERT INTO appeal_actions (guild_id, appeal_id, action) VALUES (?, ?, 'post')",
    [guild.id, (result as { insertId: number }).insertId],
  ).catch(() => undefined);
  await v2MessageReply(message, { content: `Appeal filed for case ${c.case_code}. Staff will review it.` });
}

const command: BotCommand = {
  name: 'appeal',
  category: 'moderation',
  description: 'Appeal a punishment case',
  usage: '!appeal <case code or number> <message>',
  details: 'You can only appeal your own active cases; kick cases and closed cases cannot be appealed. Staff review the appeal afterwards.',
  data,
  permissions: [],
  aliases: [],
  execute,
  prefixExecute,
};

export default command;