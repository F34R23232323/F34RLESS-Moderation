import { SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction, Message } from 'discord.js';
import type { RowDataPacket } from 'mysql2/promise';
import type { App } from '../../core/context';
import type { BotCommand } from '../../types/command';
import { v2Reply, v2MessageReply } from '../../utils/v2';
import { resolveMemberOption } from '../../utils/discord';
import { parseTargetId, mapDiscordError } from '../../utils/moderationErrors';

const MAX_NICKNAME_LENGTH = 32;

const data = new SlashCommandBuilder()
  .setName('nick')
  .setDescription('Set, reset, or lock a user nickname')
  .addSubcommand((s) => s.setName('set').setDescription('Set a user nickname').addUserOption((o) => o.setName('user').setDescription('Target user').setRequired(true)).addStringOption((o) => o.setName('nickname').setDescription('New nickname').setRequired(true).setMaxLength(MAX_NICKNAME_LENGTH)))
  .addSubcommand((s) => s.setName('reset').setDescription('Reset a nickname to the default username').addUserOption((o) => o.setName('user').setDescription('Target user').setRequired(true)))
  .addSubcommand((s) => s.setName('lock').setDescription('Lock a nickname (auto-revert)').addUserOption((o) => o.setName('user').setDescription('Target user').setRequired(true)).addStringOption((o) => o.setName('nickname').setDescription('Locked nickname').setRequired(true).setMaxLength(MAX_NICKNAME_LENGTH)))
  .addSubcommand((s) => s.setName('unlock').setDescription('Unlock a nickname').addUserOption((o) => o.setName('user').setDescription('Target user').setRequired(true)));

async function getActiveLock(app: App, guildId: string, userId: string): Promise<string | null> {
  const [rows] = await app.db.query<RowDataPacket[]>(
    'SELECT locked_nick FROM nick_locks WHERE guild_id = ? AND user_id = ? AND active = 1',
    [guildId, userId],
  );
  return rows[0]?.locked_nick ?? null;
}

async function setNickname(member: any, nickname: string | null, actorTag: string): Promise<void> {
  await member.setNickname(nickname, `Nickname changed by ${actorTag}`);
}

async function execute(interaction: ChatInputCommandInteraction, app: App): Promise<void> {
  await interaction.deferReply({ ephemeral: true });
  const guild = interaction.guild;
  if (!guild) return;
  const sub = interaction.options.getSubcommand();
  const resolved = await resolveMemberOption(interaction, guild, app);
  if (!resolved?.member || !resolved.user) {
    await v2Reply(interaction, 'User not found.', { ephemeral: true });
    return;
  }
  const guard = app.modGuard.canModerate(resolved.member, interaction.member as never);
  if (!guard.ok) {
    await v2Reply(interaction, `Cannot change nickname: ${guard.reason}`, { ephemeral: true });
    return;
  }
  const targetId = resolved.user.id;

  try {
    if (sub === 'set') {
      const nickname = interaction.options.getString('nickname', true).trim();
      const locked = await getActiveLock(app, guild.id, targetId);
      if (locked !== null) {
        const text = locked === nickname
          ? `<@${targetId}> is already locked to \`${locked}\`.`
          : `<@${targetId}> has a locked nickname \`${locked}\` — any change is reverted. Use \`lock\` to change it or \`unlock\` to release it.`;
        await v2Reply(interaction, text, { ephemeral: true });
        return;
      }
      await setNickname(resolved.member, nickname, interaction.user.tag);
      await v2Reply(interaction, `Set <@${targetId}>'s nickname to \`${nickname}\`.`);
    } else if (sub === 'reset') {
      await setNickname(resolved.member, null, interaction.user.tag);
      await app.db.execute('UPDATE nick_locks SET active = 0 WHERE guild_id = ? AND user_id = ?', [guild.id, targetId]);
      await v2Reply(interaction, `Reset <@${targetId}>'s nickname.`);
    } else if (sub === 'lock') {
      const nickname = interaction.options.getString('nickname', true).trim();
      await setNickname(resolved.member, nickname, interaction.user.tag);
      await app.db.execute(
        `INSERT INTO nick_locks (guild_id, user_id, locked_nick, active) VALUES (?, ?, ?, 1)
         ON DUPLICATE KEY UPDATE locked_nick = VALUES(locked_nick), active = 1`,
        [guild.id, targetId, nickname],
      );
      await v2Reply(interaction, `Locked <@${targetId}>'s nickname to \`${nickname}\`.`);
    } else if (sub === 'unlock') {
      await app.db.execute('UPDATE nick_locks SET active = 0 WHERE guild_id = ? AND user_id = ?', [guild.id, targetId]);
      await v2Reply(interaction, `Unlocked <@${targetId}>'s nickname.`);
    }
  } catch (err) {
    await v2Reply(interaction, `Failed: ${mapDiscordError((err as Error).message)}`, { ephemeral: true });
  }
}

const PREFIX_USAGE = 'Usage: `!nick <user> [nickname]`, `!nick lock <user> <nickname>`, or `!nick unlock <user>` — omit the nickname to reset.';

async function resolvePrefixMember(guild: any, raw: string | undefined, message: Message, app: App): Promise<any | null> {
  const targetId = parseTargetId(raw ?? '');
  if (!targetId) {
    await v2MessageReply(message, { content: PREFIX_USAGE });
    return null;
  }
  const member = await guild.members.fetch(targetId).catch(() => null);
  if (!member) {
    await v2MessageReply(message, { content: 'User not found in this server.' });
    return null;
  }
  const guard = app.modGuard.canModerate(member, message.member!);
  if (!guard.ok) {
    await v2MessageReply(message, { content: `Cannot change nickname: ${guard.reason}` });
    return null;
  }
  return member;
}

async function prefixExecute(message: Message, args: string[], app: App): Promise<void> {
  const guild = message.guild;
  if (!guild) {
    await v2MessageReply(message, { content: 'This command can only be used in a server.' });
    return;
  }
  const keyword = args[0]?.toLowerCase();

  try {
    if (keyword === 'unlock') {
      const member = await resolvePrefixMember(guild, args[1], message, app);
      if (!member) return;
      await app.db.execute('UPDATE nick_locks SET active = 0 WHERE guild_id = ? AND user_id = ?', [guild.id, member.id]);
      await v2MessageReply(message, { content: `Unlocked <@${member.id}>'s nickname.` });
      return;
    }

    if (keyword === 'lock' || keyword === 'reset') {
      const member = await resolvePrefixMember(guild, args[1], message, app);
      if (!member) return;
      if (keyword === 'reset') {
        await setNickname(member, null, message.author.tag);
        await app.db.execute('UPDATE nick_locks SET active = 0 WHERE guild_id = ? AND user_id = ?', [guild.id, member.id]);
        await v2MessageReply(message, { content: `Reset <@${member.id}>'s nickname.` });
        return;
      }
      const nickname = args.slice(2).join(' ').trim();
      if (!nickname) {
        await v2MessageReply(message, { content: PREFIX_USAGE });
        return;
      }
      if (nickname.length > MAX_NICKNAME_LENGTH) {
        await v2MessageReply(message, { content: `Nicknames can be at most ${MAX_NICKNAME_LENGTH} characters.` });
        return;
      }
      await setNickname(member, nickname, message.author.tag);
      await app.db.execute(
        `INSERT INTO nick_locks (guild_id, user_id, locked_nick, active) VALUES (?, ?, ?, 1)
         ON DUPLICATE KEY UPDATE locked_nick = VALUES(locked_nick), active = 1`,
        [guild.id, member.id, nickname],
      );
      await v2MessageReply(message, { content: `Locked <@${member.id}>'s nickname to \`${nickname}\`.` });
      return;
    }

    const member = await resolvePrefixMember(guild, args[0], message, app);
    if (!member) return;
    const nickname = args.slice(1).join(' ').trim();
    if (!nickname) {
      await setNickname(member, null, message.author.tag);
      await app.db.execute('UPDATE nick_locks SET active = 0 WHERE guild_id = ? AND user_id = ?', [guild.id, member.id]);
      await v2MessageReply(message, { content: `Reset <@${member.id}>'s nickname.` });
      return;
    }
    if (nickname.length > MAX_NICKNAME_LENGTH) {
      await v2MessageReply(message, { content: `Nicknames can be at most ${MAX_NICKNAME_LENGTH} characters.` });
      return;
    }
    const locked = await getActiveLock(app, guild.id, member.id);
    if (locked !== null) {
      const text = locked === nickname
        ? `<@${member.id}> is already locked to \`${locked}\`.`
        : `<@${member.id}> has a locked nickname \`${locked}\` — any change is reverted. Use \`!nick lock\` to change it or \`!nick unlock\` to release it.`;
      await v2MessageReply(message, { content: text });
      return;
    }
    await setNickname(member, nickname, message.author.tag);
    await v2MessageReply(message, { content: `Set <@${member.id}>'s nickname to \`${nickname}\`.` });
  } catch (err) {
    await v2MessageReply(message, { content: `Failed: ${mapDiscordError((err as Error).message)}` });
  }
}

const command: BotCommand = {
  name: 'nick',
  category: 'moderation',
  description: 'Set, reset, or lock a user nickname',
  usage: ['!nick <user> [nickname]', '!nick lock <user> <nickname>', '!nick unlock <user>'],
  details: 'Omit the nickname to reset the user to their default username. `lock` forces a nickname and reverts any change to it; `unlock` releases the lock.',
  data,
  permissions: ['ManageNicknames'],
  aliases: ['nickname'],
  execute,
  prefixExecute,
};

export default command;
