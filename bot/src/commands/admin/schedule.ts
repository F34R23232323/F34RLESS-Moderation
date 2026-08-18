import { SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction, Message } from 'discord.js';
import type { App } from '../../core/context';
import type { BotCommand } from '../../types/command';
import { v2Reply } from '../../utils/v2';

const data = (new SlashCommandBuilder() as any)
  .setName('schedule')
  .setDescription('Schedule a one-off or recurring announcement (staff)')
  .addSubcommand((s: any) => s.setName('once').setDescription('One-off announcement').addStringOption((o: any) => o.setName('datetime').setDescription('ISO datetime').setRequired(true)).addStringOption((o: any) => o.setName('message').setDescription('Message').setRequired(true)).addChannelOption((o: any) => o.setName('channel').setDescription('Target channel').setRequired(false)))
  .addSubcommand((s: any) => s.setName('recurring').setDescription('Recurring announcement').addStringOption((o: any) => o.setName('cron').setDescription('Cron expression, e.g. 0 9 * * *').setRequired(true)).addStringOption((o: any) => o.setName('message').setDescription('Message').setRequired(true)).addChannelOption((o: any) => o.setName('channel').setDescription('Target channel').setRequired(false)));

async function execute(interaction: ChatInputCommandInteraction, app: App): Promise<void> {
  await interaction.deferReply({ ephemeral: true });
  const guild = interaction.guild;
  if (!guild) return;
  const sub = interaction.options.getSubcommand();
  const channel = interaction.options.getChannel('channel') ?? interaction.channel;
  const message = interaction.options.getString('message', true);
  if (!channel || !('send' in channel)) {
    await v2Reply(interaction, 'Invalid channel.', { ephemeral: true });
    return;
  }
  if (sub === 'once') {
    const dt = Date.parse(interaction.options.getString('datetime', true));
    if (Number.isNaN(dt)) {
      await v2Reply(interaction, 'Invalid datetime.', { ephemeral: true });
      return;
    }
    await app.db.execute(
      'INSERT INTO scheduled_announcements (guild_id, channel_id, content, cron, next_run, created_by) VALUES (?, ?, ?, ?, ?, ?)',
      [guild.id, channel.id, JSON.stringify({ content: message }), '@once', new Date(dt), interaction.user.id],
    );
    await v2Reply(interaction, `Scheduled one-off for <t:${Math.floor(dt / 1000)}:F>.`, { ephemeral: true });
  } else {
    const cron = interaction.options.getString('cron', true);
    const { validate } = await import('node-cron');
    if (!validate(cron)) {
      await v2Reply(interaction, 'Invalid cron expression.', { ephemeral: true });
      return;
    }
    const next = new Date(Date.now() + 60000);
    await app.db.execute(
      'INSERT INTO scheduled_announcements (guild_id, channel_id, content, cron, next_run, created_by) VALUES (?, ?, ?, ?, ?, ?)',
      [guild.id, channel.id, JSON.stringify({ content: message }), cron, next, interaction.user.id],
    );
    await v2Reply(interaction, `Recurring announcement scheduled (\`${cron}\`).`, { ephemeral: true });
  }
}

const command: BotCommand = {
  name: 'schedule',
  category: 'admin',
  description: 'Schedule a one-off or recurring announcement (staff)',
  data,
  permissions: ['ManageMessages'],
  aliases: ['announcement'],
  execute,
};

export default command;