import { SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction, Message } from 'discord.js';
import type { App } from '../../core/context';
import type { BotCommand } from '../../types/command';
import { v2Reply } from '../../utils/v2';
import { resolveMemberOption } from '../../utils/discord';
import { v2MessageReply } from '../../utils/v2';
import { parseTargetId } from '../../utils/moderationErrors';

const data = new SlashCommandBuilder()
  .setName('snapshot')
  .setDescription('Snapshot a member\'s roles and nickname')
  .addUserOption((o) => o.setName('user').setDescription('Target user').setRequired(true))
  .addStringOption((o) => o.setName('reason').setDescription('Why').setRequired(false));

async function execute(interaction: ChatInputCommandInteraction, app: App): Promise<void> {
  await interaction.deferReply({ ephemeral: true });
  const guild = interaction.guild;
  if (!guild) return;
  const resolved = await resolveMemberOption(interaction, guild, app);
  if (!resolved?.member) {
    await v2Reply(interaction, 'User not found.', { ephemeral: true });
    return;
  }
  const roles = resolved.member.roles.cache.filter((r: any) => r.id !== guild.id && !r.managed).map((r: any) => r.id);
  const nickname = resolved.member.nickname;
  const reason = interaction.options.getString('reason') ?? null;
  await app.db.execute(
    'INSERT INTO member_snapshots (guild_id, user_id, roles, nickname, reason, taken_by) VALUES (?, ?, ?, ?, ?, ?)',
    [guild.id, resolved.user!.id, JSON.stringify(roles), nickname, reason, interaction.user.id],
  );
  await v2Reply(interaction, `Snapshot saved for <@${resolved.user!.id}> (${roles.length} roles).`);
}

async function prefixExecute(message: Message, args: string[], app: App): Promise<void> {
  const guild = message.guild;
  const targetId = parseTargetId(args[0]);
  const reason = args.slice(1).join(' ') || null;
  if (!guild || !targetId) {
    await v2MessageReply(message, { content: 'Usage: `!snapshot <user> <reason>`' });
    return;
  }
  const member = await guild.members.fetch(targetId).catch(() => null);
  if (!member) {
    await v2MessageReply(message, { content: 'User not found.' });
    return;
  }
  const roles = member.roles.cache.filter((r: any) => r.id !== guild.id && !r.managed).map((r: any) => r.id);
  await app.db.execute(
    'INSERT INTO member_snapshots (guild_id, user_id, roles, nickname, reason, taken_by) VALUES (?, ?, ?, ?, ?, ?)',
    [guild.id, targetId, JSON.stringify(roles), member.nickname, reason, message.author.id],
  );
  await v2MessageReply(message, { content: `Snapshot saved for <@${targetId}> (${roles.length} roles).` });
}

const command: BotCommand = {
  name: 'snapshot',
  category: 'moderation',
  description: 'Snapshot a member\'s roles and nickname',
  usage: '!snapshot <user> <reason>',
  details: 'Saves the current roles and nickname so they can be re-applied later with `!restore`.',
  data,
  permissions: ['ModerateMembers'],
  aliases: [],
  execute,
  prefixExecute,
};

export default command;