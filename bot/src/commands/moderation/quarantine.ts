import { SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction, Message } from 'discord.js';
import type { App } from '../../core/context';
import type { BotCommand } from '../../types/command';
import { v2Reply } from '../../utils/v2';
import { resolveMemberOption } from '../../utils/discord';

const data = new SlashCommandBuilder()
  .setName('quarantine')
  .setDescription('Strip roles and apply a restricted role pending investigation')
  .addUserOption((o) => o.setName('user').setDescription('Target user').setRequired(true));

async function execute(interaction: ChatInputCommandInteraction, app: App): Promise<void> {
  await interaction.deferReply();
  const guild = interaction.guild;
  if (!guild) return;
  const resolved = await resolveMemberOption(interaction, guild, app);
  if (!resolved?.member) {
    await v2Reply(interaction, 'User not found.', { ephemeral: true });
    return;
  }
  const guard = app.modGuard.canModerate(resolved.member, interaction.member as never);
  if (!guard.ok) {
    await v2Reply(interaction, `Cannot quarantine: ${guard.reason}`, { ephemeral: true });
    return;
  }
  const restrictedRoleId = app.config.quarantine.restricted_role_id;
  if (!restrictedRoleId) {
    await v2Reply(interaction, 'No restricted role configured (config.yml -> quarantine.restricted_role_id).', { ephemeral: true });
    return;
  }
  const roles = resolved.member.roles.cache.filter((r: any) => r.id !== guild.id && !r.managed).map((r: any) => r.id);
  await app.db.execute(
    `INSERT INTO quarantines (guild_id, user_id, original_roles) VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE original_roles = VALUES(original_roles), active = 1`,
    [guild.id, resolved.user!.id, JSON.stringify(roles)],
  );
  await resolved.member.roles.set([restrictedRoleId], 'Quarantined');
  await v2Reply(interaction, `Quarantined <@${resolved.user!.id}>. Roles stored for restore.`);
}

async function prefixExecute(message: Message, args: string[], app: App): Promise<void> {
  const guild = message.guild;
  const targetId = args[0]?.replace(/[<@!>]/g, '');
  if (!guild || !targetId) {
    await message.reply({ content: 'Usage: `!quarantine <user>`' });
    return;
  }
  const member = await guild.members.fetch(targetId).catch(() => null);
  if (!member) {
    await message.reply({ content: 'User not found.' });
    return;
  }
  const restrictedRoleId = app.config.quarantine.restricted_role_id;
  if (!restrictedRoleId) {
    await message.reply({ content: 'No restricted role configured.' });
    return;
  }
  const roles = member.roles.cache.filter((r: any) => r.id !== guild.id && !r.managed).map((r: any) => r.id);
  await app.db.execute(
    `INSERT INTO quarantines (guild_id, user_id, original_roles) VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE original_roles = VALUES(original_roles), active = 1`,
    [guild.id, targetId, JSON.stringify(roles)],
  );
  await member.roles.set([restrictedRoleId], 'Quarantined');
  await message.reply({ content: `Quarantined <@${targetId}>.` });
}

const command: BotCommand = {
  name: 'quarantine',
  category: 'moderation',
  description: 'Strip roles and apply a restricted role pending investigation',
  data,
  permissions: ['ModerateMembers'],
  aliases: ['q'],
  execute,
  prefixExecute,
};

export default command;