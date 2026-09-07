import { SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction, Message } from 'discord.js';
import type { App } from '../../core/context';
import type { BotCommand } from '../../types/command';
import { v2Reply } from '../../utils/v2';
import { v2MessageReply } from '../../utils/v2';
import type { RowDataPacket } from 'mysql2/promise';

const data = new SlashCommandBuilder()
  .setName('achievements')
  .setDescription('View achievements')
  .addUserOption((o) => o.setName('user').setDescription('View another user\'s achievements').setRequired(false));

async function execute(interaction: ChatInputCommandInteraction, app: App): Promise<void> {
  await interaction.deferReply();
  if (!app.economy.isEnabled(interaction.guildId!)) { await v2Reply(interaction, 'Economy is not enabled.'); return; }
  const target = interaction.options.getUser('user') ?? interaction.user;
  const [achievements] = await app.db.query<RowDataPacket[]>(
    'SELECT * FROM economy_achievements WHERE guild_id = ? AND enabled = 1 AND hidden = 0 ORDER BY points DESC',
    [interaction.guildId!],
  );
  if (achievements.length === 0) { await v2Reply(interaction, 'No achievements defined.'); return; }

  const [unlocked] = await app.db.query<RowDataPacket[]>(
    'SELECT achievement_id FROM economy_achievement_unlocks WHERE guild_id = ? AND user_id = ?',
    [interaction.guildId!, target.id],
  );
  const unlockedIds = new Set(unlocked.map((u: any) => u.achievement_id));

  const lines = achievements.map((a: any) => {
    const done = unlockedIds.has(a.id);
    return `${done ? '✅' : '⬜'} ${a.emoji ?? ''} **${a.name}** (${a.points} pts) — ${a.description ?? ''}`;
  });
  await v2Reply(interaction, `**${target.username}'s Achievements** (${unlockedIds.size}/${achievements.length})\n\n${lines.join('\n')}`);
}

async function prefixExecute(message: Message, args: string[], app: App): Promise<void> {
  if (!app.economy.isEnabled(message.guildId!)) { await v2MessageReply(message, { content: 'Economy is not enabled.' }); return; }
  const targetId = args[0]?.replace(/[<@!>]/g, '') || message.author.id;
  const target = await app.client.users.fetch(targetId).catch(() => null);
  if (!target) { await v2MessageReply(message, { content: 'User not found.' }); return; }
  const [achievements] = await app.db.query<RowDataPacket[]>(
    'SELECT * FROM economy_achievements WHERE guild_id = ? AND enabled = 1 AND hidden = 0 ORDER BY points DESC',
    [message.guildId!],
  );
  if (achievements.length === 0) { await v2MessageReply(message, { content: 'No achievements defined.' }); return; }
  const [unlocked] = await app.db.query<RowDataPacket[]>(
    'SELECT achievement_id FROM economy_achievement_unlocks WHERE guild_id = ? AND user_id = ?',
    [message.guildId!, target.id],
  );
  const unlockedIds = new Set(unlocked.map((u: any) => u.achievement_id));
  const lines = achievements.map((a: any) => `${unlockedIds.has(a.id) ? '✅' : '⬜'} **${a.name}** (${a.points} pts)`);
  await v2MessageReply(message, { content: `**${target.username}'s Achievements** (${unlockedIds.size}/${achievements.length})\n${lines.join('\n')}` });
}

const command: BotCommand = {
  name: 'achievements',
  category: 'community',
  description: 'View achievements',
  data,
  aliases: ['achieve', 'achs'],
  execute,
  prefixExecute,
};

export default command;
