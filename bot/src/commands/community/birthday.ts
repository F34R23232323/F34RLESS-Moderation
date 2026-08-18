import { SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction, Message } from 'discord.js';
import type { App } from '../../core/context';
import type { BotCommand } from '../../types/command';
import { v2Reply } from '../../utils/v2';

const data = new SlashCommandBuilder()
  .setName('birthday')
  .setDescription('Opt in/out of birthday tracking')
  .addSubcommand((s) => s.setName('set').setDescription('Set your birthday').addIntegerOption((o) => o.setName('month').setDescription('Month 1-12').setMinValue(1).setMaxValue(12).setRequired(true)).addIntegerOption((o) => o.setName('day').setDescription('Day 1-31').setMinValue(1).setMaxValue(31).setRequired(true)))
  .addSubcommand((s) => s.setName('remove').setDescription('Remove your birthday'));

async function execute(interaction: ChatInputCommandInteraction, app: App): Promise<void> {
  const cfg = app.config.community.birthdays;
  const guild = interaction.guild;
  if (!guild) return;
  if (!cfg.enabled) {
    await v2Reply(interaction, 'Birthdays are not enabled.', { ephemeral: true });
    return;
  }
  const sub = interaction.options.getSubcommand();
  if (sub === 'set') {
    const month = interaction.options.getInteger('month', true);
    const day = interaction.options.getInteger('day', true);
    if (day > 31 || (month === 2 && day > 29) || ([4, 6, 9, 11].includes(month) && day > 30)) {
      await v2Reply(interaction, 'Invalid day for that month.', { ephemeral: true });
      return;
    }
    await app.db.execute(
      `INSERT INTO birthdays (user_id, guild_id, month, day, timezone) VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE month = VALUES(month), day = VALUES(day)`,
      [interaction.user.id, guild.id, month, day, cfg.timezone],
    );
    await v2Reply(interaction, `Birthday set to ${month}/${day}.`, { ephemeral: true });
  } else {
    await app.db.execute('DELETE FROM birthdays WHERE user_id = ? AND guild_id = ?', [interaction.user.id, guild.id]);
    await v2Reply(interaction, 'Birthday removed.', { ephemeral: true });
  }
}

const command: BotCommand = {
  name: 'birthday',
  category: 'community',
  description: 'Opt in/out of birthday tracking',
  data,
  permissions: [],
  aliases: [],
  execute,
};

export default command;