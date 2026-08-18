import { SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction, Message } from 'discord.js';
import type { App } from '../../core/context';
import type { RowDataPacket } from 'mysql2/promise';
import type { BotCommand } from '../../types/command';
import { v2Reply } from '../../utils/v2';
import { parseDuration } from '../../../../shared/src/index';

const data = new SlashCommandBuilder()
  .setName('giveaway')
  .setDescription('Start or reroll a giveaway')
  .addSubcommand((s) => s.setName('start').setDescription('Start a giveaway').addStringOption((o) => o.setName('prize').setDescription('Prize').setRequired(true)).addStringOption((o) => o.setName('duration').setDescription('Duration e.g. 1h, 2d').setRequired(true)).addIntegerOption((o) => o.setName('winners').setDescription('Winner count').setMinValue(1).setRequired(false)))
  .addSubcommand((s) => s.setName('reroll').setDescription('Reroll a giveaway').addStringOption((o) => o.setName('message_id').setDescription('Giveaway message ID').setRequired(true)));

async function execute(interaction: ChatInputCommandInteraction, app: App): Promise<void> {
  const cfg = app.config.community.giveaways;
  if (!cfg.enabled) {
    await v2Reply(interaction, 'Giveaways are not enabled.', { ephemeral: true });
    return;
  }
  await interaction.deferReply();
  const sub = interaction.options.getSubcommand();
  const guild = interaction.guild;
  if (!guild) return;

  if (sub === 'start') {
    const prize = interaction.options.getString('prize', true);
    const duration = parseDuration(interaction.options.getString('duration', true));
    const winners = interaction.options.getInteger('winners') ?? 1;
    if (!duration || duration.isPermanent) {
      await v2Reply(interaction, 'Provide a valid duration.', { ephemeral: true });
      return;
    }
    const endsAt = new Date(Date.now() + duration.milliseconds);
    const [result] = await app.db.execute(
      'INSERT INTO giveaways (guild_id, channel_id, prize, winners, ends_at, created_by) VALUES (?, ?, ?, ?, ?, ?)',
      [guild.id, interaction.channelId, prize, winners, endsAt, interaction.user.id],
    );
    const id = (result as { insertId: number }).insertId;
    const content = `**Giveaway: ${prize}**\nWinners: ${winners}\nEnds: <t:${Math.floor(endsAt.getTime() / 1000)}:R>\nReact to enter!`;
    const sent = await interaction.editReply({
      content,
      components: [{ type: 1, components: [{ type: 2, custom_id: `giveaway:enter:${id}`, label: 'Enter', style: 3 }] }],
    });
    await app.db.execute('UPDATE giveaways SET message_id = ? WHERE id = ?', [sent.id, id]);
    app.scheduler.setTimeout(`giveaway:${id}`, duration.milliseconds, async () => {
      const draw = await import('../../community/giveaways');
      await draw.draw(app, id);
    });
  } else {
    const messageId = interaction.options.getString('message_id', true);
    const [rows] = await app.db.query<RowDataPacket[]>(
      'SELECT id FROM giveaways WHERE message_id = ?',
      [messageId],
    );
    const row = rows[0];
    if (!row) {
      await v2Reply(interaction, 'Giveaway not found.', { ephemeral: true });
      return;
    }
    const draw = await import('../../community/giveaways');
    await draw.draw(app, Number(row.id), true);
  }
}

const command: BotCommand = {
  name: 'giveaway',
  category: 'community',
  description: 'Start or reroll a giveaway',
  data,
  permissions: ['ManageMessages'],
  aliases: [],
  execute,
};

export default command;