import { SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction } from 'discord.js';
import type { App } from '../../core/context';
import type { BotCommand } from '../../types/command';
import { v2Reply } from '../../utils/v2';
import { isAppealsStaff } from '../../services/appealService';

// Staff-only: lift all active appeal blocks for a user in this guild.
const data = new SlashCommandBuilder()
  .setName('unblock-appeal-user')
  .setDescription('Unblock a user from submitting appeals (staff only)')
  .addUserOption((o) => o.setName('user').setDescription('User to unblock').setRequired(true));

async function execute(interaction: ChatInputCommandInteraction, app: App): Promise<void> {
  const guild = interaction.guild;
  if (!guild) {
    await v2Reply(interaction, 'This command must be run in a server.', { ephemeral: true });
    return;
  }
  if (!isAppealsStaff(app, { guild, member: interaction.member as never })) {
    await v2Reply(interaction, 'You do not have permission to unblock appeal access.', { ephemeral: true });
    return;
  }

  const target = interaction.options.getUser('user', true);
  const [result] = await app.db.execute(
    'UPDATE appeal_blocks SET active = 0 WHERE guild_id = ? AND user_id = ? AND active = 1',
    [guild.id, target.id],
  );
  const affected = (result as { affectedRows: number }).affectedRows;

  await app.logManager.log({
    event: 'moderation_action',
    guildId: guild.id,
    actorId: interaction.user.id,
    targetId: target.id,
    message: `Unblocked <@${target.id}> from submitting appeals`,
    details: { hadActiveBlock: affected > 0 },
  });

  await v2Reply(
    interaction,
    affected > 0 ? `Unblocked <@${target.id}> — they can submit appeals again.` : `<@${target.id}> had no active appeal block.`,
    { ephemeral: true },
  );
}

const command: BotCommand = {
  name: 'unblock-appeal-user',
  category: 'moderation',
  description: 'Unblock a user from submitting appeals (staff only)',
  data,
  permissions: [],
  aliases: [],
  execute,
};

export default command;
