import { SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction, GuildMember, Message } from 'discord.js';
import type { RowDataPacket } from 'mysql2/promise';
import type { App } from '../../core/context';
import type { BotCommand } from '../../types/command';
import { v2Reply } from '../../utils/v2';
import { v2MessageReply } from '../../utils/v2';

const data = new SlashCommandBuilder()
  .setName('archives')
  .setDescription('List recent message archives (staff only)')
  .addIntegerOption((o) => o.setName('limit').setDescription('How many to show').setMinValue(1).setMaxValue(25).setRequired(false));

function canView(app: App, member: GuildMember | null): boolean {
  if (!member) return false;
  if (app.modGuard.isOwner(member.id)) return true;
  if (app.config.archives.allowed_users.includes(member.id)) return true;
  if (app.config.archives.allowed_roles.some((r) => member.roles.cache.has(r))) return true;
  return false;
}

async function fetchList(app: App, guildId: string, limit: number): Promise<RowDataPacket[]> {
  const [rows] = await app.db.query<RowDataPacket[]>(
    `SELECT code, kind, title, message_count, media_count, total_bytes, created_at
     FROM archives WHERE guild_id = ? ORDER BY created_at DESC LIMIT ?`,
    [guildId, limit],
  );
  return rows;
}

function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

async function buildListText(app: App, guildId: string, limit: number): Promise<string> {
  const rows = await fetchList(app, guildId, limit);
  if (rows.length === 0) return 'No archives yet. Run `!archive <amount> [user] [#channel]` to create one.';
  const lines = rows.map((r, i) => {
    const title = r.title ? ` — ${r.title}` : '';
    const when = new Date(r.created_at).toLocaleDateString();
    return `\`${r.code}\` • ${r.kind} • ${r.message_count} msg • ${r.media_count} media (${fmtBytes(Number(r.total_bytes) || 0)}) • ${when}${title}\n<${app.archives.getPublicLink(String(r.code))}>`;
  });
  return lines.join('\n\n');
}

async function execute(interaction: ChatInputCommandInteraction, app: App): Promise<void> {
  await interaction.deferReply({ ephemeral: true });
  const guild = interaction.guild;
  if (!guild) return;
  if (!canView(app, interaction.member as GuildMember | null)) {
    await v2Reply(interaction, 'You do not have permission to view archives.', { ephemeral: true });
    return;
  }
  const limit = interaction.options.getInteger('limit') ?? 10;
  const text = await buildListText(app, guild.id, limit);
  await v2Reply(interaction, text.length > 3800 ? `${text.slice(0, 3800)}…` : text, { ephemeral: true });
}

async function prefixExecute(message: Message, args: string[], app: App): Promise<void> {
  const guild = message.guild;
  if (!guild) return;
  if (!canView(app, message.member)) {
    await v2MessageReply(message, { content: 'You do not have permission to view archives.' });
    return;
  }
  const limit = Math.min(Math.max(parseInt(args[0] ?? '10', 10) || 10, 1), 25);
  const text = await buildListText(app, guild.id, limit);
  const sent = await v2MessageReply(message, { content: text.length > 3800 ? `${text.slice(0, 3800)}…` : text });
  setTimeout(() => sent.delete().catch(() => undefined), 20_000);
}

const command: BotCommand = {
  name: 'archives',
  category: 'moderation',
  description: 'List recent message archives (staff only)',
  data,
  permissions: [],
  aliases: ['archiveslist', 'alist'],
  execute,
  prefixExecute,
};

export default command;
