import type { ButtonInteraction } from 'discord.js';
import type { ComponentHandler } from '../core/componentLoader';
import type { App } from '../core/context';

const APPROVED_ROLE_ID = '1485003950888456335';

function extractUserId(customId: string, interaction: ButtonInteraction): string {
  const parts = customId.split(':');
  if (parts.length >= 3 && parts[2]) return parts[2];
  return interaction.user.id;
}

const acceptHandler: ComponentHandler = {
  type: 'button',
  id: 'emergency_access:accept',
  async run(app: App, interaction: ButtonInteraction) {
    if (!interaction.guild) {
      await interaction.reply({ content: 'This can only be used in a server.', ephemeral: true });
      return;
    }

    const userId = extractUserId(interaction.customId, interaction);

    if (interaction.user.id !== userId) {
      await interaction.reply({ content: 'This button is not for you.', ephemeral: true });
      return;
    }

    const member = await interaction.guild.members.fetch(userId).catch(() => null);
    if (!member) {
      await interaction.reply({ content: 'Could not find your membership.', ephemeral: true });
      return;
    }

    if (member.roles.cache.has(APPROVED_ROLE_ID)) {
      await interaction.update({
        content: 'You already have emergency ping access.',
        components: [],
        embeds: [],
      } as never);
      return;
    }

    const role = interaction.guild.roles.cache.get(APPROVED_ROLE_ID);
    const me = interaction.guild.members.me;
    if (!role || !me || role.position >= me.roles.highest.position) {
      await interaction.update({
        content: 'Emergency access role is misconfigured (bot role too low).',
        components: [],
        embeds: [],
      } as never);
      return;
    }

    await member.roles.add(APPROVED_ROLE_ID, 'Agreed to emergency staff ping terms');

    await app.db.execute(
      `INSERT INTO emergency_ping_access (guild_id, user_id, status, granted_by)
       VALUES (?, ?, 'granted', ?)
       ON DUPLICATE KEY UPDATE status = 'granted', granted_by = VALUES(granted_by), revoked_by = NULL`,
      [interaction.guildId!, userId, userId],
    );

    await app.logManager.log({
      event: 'emergency_access_granted',
      guildId: interaction.guildId!,
      actorId: userId,
      targetId: userId,
      message: `<@${userId}> accepted emergency staff ping terms and was granted access`,
    });

    await interaction.update({
      content: 'You have been granted emergency staff ping access. You can now use `!emergency <reason>` or `/emergency <reason>` to ping staff.',
      components: [],
      embeds: [],
    } as never);
  },
};

const declineHandler: ComponentHandler = {
  type: 'button',
  id: 'emergency_access:decline',
  async run(app: App, interaction: ButtonInteraction) {
    const userId = extractUserId(interaction.customId, interaction);

    await app.logManager.log({
      event: 'emergency_access_denied',
      guildId: interaction.guildId!,
      actorId: userId,
      targetId: userId,
      message: `<@${userId}> declined emergency staff ping terms`,
    });

    await interaction.update({
      content: 'You declined the terms. Emergency staff ping access has not been granted.',
      components: [],
      embeds: [],
    } as never);
  },
};

export default [acceptHandler, declineHandler];
