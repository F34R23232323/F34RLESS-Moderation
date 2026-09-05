import { SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction } from 'discord.js';
import type { App } from '../../core/context';
import type { BotCommand } from '../../types/command';
import { v2Reply, v2Send } from '../../utils/v2';

const data = new SlashCommandBuilder()
  .setName('verify')
  .setDescription('Post the verification panel or manually verify a user')
  .addUserOption((o) => o.setName('user').setDescription('User to manually verify (leave empty to post panel)').setRequired(false));

async function execute(interaction: ChatInputCommandInteraction, app: App): Promise<void> {
  const cfg = app.config.verification_gate;
  const guild = interaction.guild;
  if (!cfg.enabled || !guild) {
    await v2Reply(interaction, 'Verification gate is not enabled.', { ephemeral: true });
    return;
  }

  const targetUser = interaction.options.getUser('user');

  if (!targetUser) {
    const emoji = interaction.client.emojis.cache.get('1456689407196139736');
    const emojiText = emoji ? `${emoji} ` : '';

    await v2Send(interaction.channel as never, `${emojiText}**Welcome to ${guild.name}!**

Click the button below to verify and gain full access to the server. You will need to solve a quick captcha to prove you are human.`, {
      buttons: [{ customId: 'verify:start', label: 'Verify', style: 3 }],
      accentColor: '#5865f2',
    });
    await v2Reply(interaction, 'Verification panel posted.', { ephemeral: true });
    return;
  }

  await interaction.deferReply({ ephemeral: true });

  const member = await guild.members.fetch(targetUser.id).catch(() => null);
  if (!member) {
    await interaction.editReply('User is not in this server.');
    return;
  }

  const verifiedRoleId = cfg.verified_role_id;
  if (!verifiedRoleId) {
    await interaction.editReply('No verified role configured.');
    return;
  }

  const verifiedRole = guild.roles.cache.get(verifiedRoleId);
  const me = guild.members.me;
  if (!verifiedRole || !me || verifiedRole.position >= me.roles.highest.position) {
    await interaction.editReply('Verified role is misconfigured (bot role too low).');
    return;
  }

  if (member.roles.cache.has(verifiedRoleId)) {
    await interaction.editReply('This user is already verified.');
    return;
  }

  await member.roles.add(verifiedRoleId, `Manually verified by ${interaction.user.tag}`);

  if (cfg.unverified_role_id && member.roles.cache.has(cfg.unverified_role_id)) {
    await member.roles.remove(cfg.unverified_role_id, 'Verified').catch(() => undefined);
  }

  await app.db.execute("UPDATE gates SET state = 'verified' WHERE guild_id = ? AND user_id = ?", [guild.id, targetUser.id]);
  await app.logManager.log({
    event: 'member_join',
    guildId: guild.id,
    targetId: targetUser.id,
    message: `<@${targetUser.id}> manually verified by <@${interaction.user.id}>`,
  });

  if (cfg.log_channel_id) {
    const channel = guild.channels.cache.get(cfg.log_channel_id);
    if (channel && 'send' in channel) {
      await v2Send(channel as never, `**Manual Verification**\n**User:** <@${targetUser.id}> (\`${targetUser.id}\`)\n**Moderator:** <@${interaction.user.id}>\n**Time:** <t:${Math.floor(Date.now() / 1000)}:R>`, { accentColor: '#5865f2' }).catch(() => undefined);
    }
  }

  await interaction.editReply(`Verified <@${targetUser.id}>.`);
}

const command: BotCommand = {
  name: 'verify',
  category: 'admin',
  description: 'Post the verification panel or manually verify a user',
  data,
  permissions: ['ManageGuild'],
  aliases: ['verifypanel', 'manualverify'],
  execute,
};

export default command;
