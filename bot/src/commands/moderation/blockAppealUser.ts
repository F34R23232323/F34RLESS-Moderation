import { SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction } from 'discord.js';
import type { App } from '../../core/context';
import type { BotCommand } from '../../types/command';
import { v2Reply } from '../../utils/v2';
import { isAppealsStaff } from '../../services/appealService';
import { resolveAppealConfig, parseDuration } from '../../../../shared/src/index';

// Staff-only: block a user from submitting appeals in this guild. The reason
// defaults to the guild's appeals.blocking.default_reason; an optional
// duration (e.g. "7d", "2h") makes the block temporary (omitted = permanent).
const data = new SlashCommandBuilder()
  .setName('block-appeal-user')
  .setDescription('Block a user from submitting appeals (staff only)')
  .addUserOption((o) => o.setName('user').setDescription('User to block').setRequired(true))
  .addStringOption((o) => o.setName('duration').setDescription('How long the block lasts, e.g. 7d (empty = permanent)').setRequired(false))
  .addStringOption((o) => o.setName('reason').setDescription('Reason shown to the user (defaults to config)').setRequired(false).setMaxLength(500));

async function execute(interaction: ChatInputCommandInteraction, app: App): Promise<void> {
  const guild = interaction.guild;
  if (!guild) {
    await v2Reply(interaction, 'This command must be run in a server.', { ephemeral: true });
    return;
  }
  if (!isAppealsStaff(app, { guild, member: interaction.member as never })) {
    await v2Reply(interaction, 'You do not have permission to block appeal access.', { ephemeral: true });
    return;
  }

  const cfg = resolveAppealConfig(app.config.appeals, guild.id);
  if (!cfg.enabled) {
    await v2Reply(interaction, 'Appeals are not enabled for this server.', { ephemeral: true });
    return;
  }

  const target = interaction.options.getUser('user', true);
  const durationStr = interaction.options.getString('duration')?.trim() || '';
  const customReason = interaction.options.getString('reason')?.trim() || '';

  let expiresAt: Date | null = null;
  if (durationStr && !/^perm$/i.test(durationStr)) {
    const parsed = parseDuration(durationStr);
    if (!parsed || parsed.isPermanent) {
      await v2Reply(interaction, `Invalid duration "${durationStr}". Use e.g. "7d", "2h30m", or leave empty for permanent.`, { ephemeral: true });
      return;
    }
    expiresAt = new Date(Date.now() + parsed.milliseconds);
  }

  const reason = customReason || cfg.blocking.default_reason;

  // Deactivate any previous active blocks for this user, then insert the new one.
  await app.db.execute('UPDATE appeal_blocks SET active = 0 WHERE guild_id = ? AND user_id = ? AND active = 1', [guild.id, target.id]);
  await app.db.execute(
    'INSERT INTO appeal_blocks (guild_id, user_id, reason, blocked_by, expires_at) VALUES (?, ?, ?, ?, ?)',
    [guild.id, target.id, reason, interaction.user.id, expiresAt],
  );

  await app.logManager.log({
    event: 'moderation_action',
    guildId: guild.id,
    actorId: interaction.user.id,
    targetId: target.id,
    message: `Blocked <@${target.id}> from submitting appeals${expiresAt ? ` until <t:${Math.floor(expiresAt.getTime() / 1000)}:R>` : ' (permanent)'}`,
    details: { reason, expiresAt: expiresAt?.toISOString() ?? null },
  });

  const expiry = expiresAt ? ` It expires <t:${Math.floor(expiresAt.getTime() / 1000)}:R>.` : ' It does not expire.';
  await v2Reply(interaction, `Blocked <@${target.id}> from submitting appeals.${expiry}`, { ephemeral: true });

  const user = await app.client.users.fetch(target.id).catch(() => null);
  if (user) {
    await user
      .send({ content: `You can no longer submit appeals in **${guild.name}**.\nReason: ${reason}\nExpires: ${expiresAt ? `<t:${Math.floor(expiresAt.getTime() / 1000)}:F>` : 'never'}` })
      .catch(() => undefined);
  }
}

const command: BotCommand = {
  name: 'block-appeal-user',
  category: 'moderation',
  description: 'Block a user from submitting appeals (staff only)',
  data,
  permissions: [],
  aliases: [],
  execute,
};

export default command;
