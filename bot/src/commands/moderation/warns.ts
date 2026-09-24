import { SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction, Message } from 'discord.js';
import type { RowDataPacket } from 'mysql2/promise';
import type { App } from '../../core/context';
import type { BotCommand } from '../../types/command';
import { v2MessageReply, v2Reply } from '../../utils/v2';
import { resolveUserOption } from '../../utils/discord';

interface WarnRow extends RowDataPacket {
  id: number;
  case_code: string;
  case_status: string;
  reason: string;
  moderator_id: string | null;
  expires_at: Date | null;
  active: number;
  created_at: Date;
}

function ts(date: Date | string | null): string {
  if (!date) return 'never';
  const ms = new Date(date).getTime();
  if (Number.isNaN(ms)) return 'never';
  return `<t:${Math.floor(ms / 1000)}:R>`;
}

const data = new SlashCommandBuilder()
  .setName('warns')
  .setDescription('List a user\'s warnings (defaults to your own)')
  .addUserOption((o) => o.setName('user').setDescription('Target user (defaults to you)').setRequired(false));

async function execute(interaction: ChatInputCommandInteraction, app: App): Promise<void> {
  await interaction.deferReply();
  const guild = interaction.guild;
  if (!guild) return;
  const user = (await resolveUserOption(interaction, app)) ?? interaction.user;
  await renderWarns(app, guild.id, user.id, user.id === interaction.user.id, (text, opts) => v2Reply(interaction, text, opts));
}

async function prefixExecute(message: Message, args: string[], app: App): Promise<void> {
  const guild = message.guild;
  if (!guild) return;
  const targetId = args[0]?.replace(/[<@!>]/g, '') || message.author.id;
  if (!/^\d{15,20}$/.test(targetId)) {
    await v2MessageReply(message, { content: 'Usage: `!warns [user]`' });
    return;
  }
  await renderWarns(app, guild.id, targetId, targetId === message.author.id, (text) => v2MessageReply(message, { content: text }));
}

async function renderWarns(
  app: App,
  guildId: string,
  userId: string,
  self: boolean,
  send: (text: string, opts?: { ephemeral?: boolean }) => Promise<unknown>,
): Promise<void> {
  const [rows, countRows] = await Promise.all([
    app.db.query<WarnRow[]>(
      `SELECT w.id, w.reason, w.moderator_id, w.expires_at, w.active, w.created_at,
              c.case_code, c.status AS case_status
       FROM warnings w
       LEFT JOIN cases c ON c.id = w.case_id
       WHERE w.guild_id = ? AND w.user_id = ?
       ORDER BY w.created_at DESC
       LIMIT 25`,
      [guildId, userId],
    ),
    app.db.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS count FROM warnings WHERE guild_id = ? AND user_id = ? AND active = 1
       AND (expires_at IS NULL OR expires_at > NOW())
       AND case_id NOT IN (SELECT id FROM cases WHERE status = 'voided')`,
      [guildId, userId],
    ),
  ]);

  const warns = rows[0] ?? [];
  const activeCount = Number(countRows[0][0]?.count ?? 0);

  if (warns.length === 0) {
    await send(self ? 'You have no warnings.' : `No warnings for <@${userId}>.`, { ephemeral: self });
    return;
  }

  const status = (w: WarnRow): string => {
    if (w.case_status === 'voided') return 'Voided';
    if (!w.active) return 'Cleared';
    if (w.expires_at && new Date(w.expires_at).getTime() <= Date.now()) return 'Expired';
    return 'Active';
  };

  const blocks = warns.map((w) => {
    const lines = [
      `**#${w.case_code}** · ${status(w)}`,
      `> Reason: ${w.reason || 'No reason provided'}`,
      `> By: ${w.moderator_id ? `<@${w.moderator_id}>` : 'unknown'} · <t:${Math.floor(new Date(w.created_at).getTime() / 1000)}:R>`,
    ];
    if (w.expires_at) lines.push(`> Expires: ${ts(w.expires_at)}`);
    return lines.join('\n');
  });

  await send(
    `**Warnings for <@${userId}>** — ${activeCount} active · ${warns.length} total shown\n${blocks.join('\n\n')}`,
    { ephemeral: self },
  );
}

const command: BotCommand = {
  name: 'warns',
  category: 'moderation',
  description: 'List a user\'s warnings (defaults to your own)',
  usage: '!warns [user]',
  data,
  permissions: ['ModerateMembers'],
  aliases: ['warnings'],
  execute,
  prefixExecute,
};

export default command;
