import { SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction, Message } from 'discord.js';
import type { App } from '../../core/context';
import type { BotCommand } from '../../types/command';
import { v2Reply } from '../../utils/v2';
import { resolveMemberOption } from '../../utils/discord';

const data = new SlashCommandBuilder()
  .setName('nick')
  .setDescription('Nickname moderation')
  .addSubcommand((s) => s.setName('reset').setDescription('Force-reset a nickname').addUserOption((o) => o.setName('user').setDescription('Target user').setRequired(true)))
  .addSubcommand((s) => s.setName('lock').setDescription('Lock a nickname (auto-revert)').addUserOption((o) => o.setName('user').setDescription('Target user').setRequired(true)).addStringOption((o) => o.setName('nickname').setDescription('Locked nickname').setRequired(true)))
  .addSubcommand((s) => s.setName('unlock').setDescription('Unlock a nickname').addUserOption((o) => o.setName('user').setDescription('Target user').setRequired(true)));

async function execute(interaction: ChatInputCommandInteraction, app: App): Promise<void> {
  await interaction.deferReply();
  const guild = interaction.guild;
  if (!guild) return;
  const sub = interaction.options.getSubcommand();
  const resolved = await resolveMemberOption(interaction, guild, app);
  if (!resolved?.member) {
    await v2Reply(interaction, 'User not found.', { ephemeral: true });
    return;
  }
  if (sub === 'reset') {
    await resolved.member.setNickname(null, 'Nickname reset');
    await app.db.execute('UPDATE nick_locks SET active = 0 WHERE guild_id = ? AND user_id = ?', [guild.id, resolved.user!.id]);
    await v2Reply(interaction, `Reset <@${resolved.user!.id}>'s nickname.`);
  } else if (sub === 'lock') {
    const nickname = interaction.options.getString('nickname', true);
    await resolved.member.setNickname(nickname, 'Nickname locked');
    await app.db.execute(
      `INSERT INTO nick_locks (guild_id, user_id, locked_nick, active) VALUES (?, ?, ?, 1)
       ON DUPLICATE KEY UPDATE locked_nick = VALUES(locked_nick), active = 1`,
      [guild.id, resolved.user!.id, nickname],
    );
    await v2Reply(interaction, `Locked <@${resolved.user!.id}>'s nickname to \`${nickname}\`.`);
  } else if (sub === 'unlock') {
    await app.db.execute('UPDATE nick_locks SET active = 0 WHERE guild_id = ? AND user_id = ?', [guild.id, resolved.user!.id]);
    await v2Reply(interaction, `Unlocked <@${resolved.user!.id}>'s nickname.`);
  }
}

const command: BotCommand = {
  name: 'nick',
  category: 'moderation',
  description: 'Nickname moderation',
  data,
  permissions: ['ManageNicknames'],
  aliases: ['nickname'],
  execute,
};

export default command;