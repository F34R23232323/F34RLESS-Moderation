import { SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction, Message } from 'discord.js';
import type { RowDataPacket } from 'mysql2/promise';
import type { App } from '../../core/context';
import type { BotCommand } from '../../types/command';
import { v2Reply } from '../../utils/v2';
import { v2MessageReply } from '../../utils/v2';

async function modStatsLines(app: App, guildId: string, days: number): Promise<string | null> {
  const [rows] = await app.db.query<RowDataPacket[]>(
    `SELECT moderator_id, COUNT(*) AS total,
      SUM(CASE WHEN type IN ('ban','kick','mute','warn') THEN 1 ELSE 0 END) AS actions
     FROM cases
     WHERE guild_id = ? AND moderator_id IS NOT NULL AND created_at > DATE_SUB(NOW(), INTERVAL ? DAY)
     GROUP BY moderator_id ORDER BY total DESC LIMIT 20`,
    [guildId, days],
  );
  if (rows.length === 0) return null;
  const lines = rows.map((r) => `<@${r.moderator_id}> — ${r.total} case(s) (${r.actions} actions)`);
  return `**Moderator activity (last ${days} days)**\n${lines.join('\n')}`;
}

const data = new SlashCommandBuilder()
  .setName('modstats')
  .setDescription('Moderator activity stats')
  .addIntegerOption((o) => o.setName('days').setDescription('Window in days').setMinValue(1).setMaxValue(90).setRequired(false));

async function execute(interaction: ChatInputCommandInteraction, app: App): Promise<void> {
  await interaction.deferReply();
  const guild = interaction.guild;
  if (!guild) return;
  const days = interaction.options.getInteger('days') ?? 30;
  const text = await modStatsLines(app, guild.id, days);
  await v2Reply(interaction, text ?? `No mod activity in the last ${days} days.`);
}

async function prefixExecute(message: Message, args: string[], app: App): Promise<void> {
  const guild = message.guild;
  if (!guild) return;
  const days = Number(args[0]) || 30;
  const text = await modStatsLines(app, guild.id, days);
  await v2MessageReply(message, { content: text ?? `No mod activity in the last ${days} days.` });
}

const command: BotCommand = {
  name: 'modstats',
  category: 'moderation',
  description: 'Moderator activity stats',
  data,
  permissions: ['ModerateMembers'],
  aliases: ['modactivity'],
  execute,
  prefixExecute,
};

export default command;