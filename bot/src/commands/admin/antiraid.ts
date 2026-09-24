import { SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction, Message } from 'discord.js';
import type { App } from '../../core/context';
import type { BotCommand } from '../../types/command';
import { v2Reply } from '../../utils/v2';
import { v2MessageReply } from '../../utils/v2';

const data = new SlashCommandBuilder()
  .setName('antiraid')
  .setDescription('Manually trigger or disable anti-raid mode')
  .addStringOption((o) => o.setName('action').setDescription('trigger or disarm').addChoices({ name: 'trigger', value: 'trigger' }, { name: 'disarm', value: 'disarm' }).setRequired(true));

async function execute(interaction: ChatInputCommandInteraction, app: App): Promise<void> {
  await interaction.deferReply();
  const guild = interaction.guild;
  if (!guild) return;
  const action = interaction.options.getString('action', true);
  if (action === 'trigger') {
    await app.antiRaid.trigger(guild.id);
    await v2Reply(interaction, 'Anti-raid mode triggered.');
  } else {
    await app.db.execute('UPDATE gates SET state = \'verified\' WHERE guild_id = ?', [guild.id]);
    await v2Reply(interaction, 'Anti-raid mode disarmed (gates reset).');
  }
}

async function prefixExecute(message: Message, args: string[], app: App): Promise<void> {
  const guild = message.guild;
  if (!guild) return;
  const action = args[0] ?? 'trigger';
  if (action === 'trigger') {
    await app.antiRaid.trigger(guild.id);
    await v2MessageReply(message, { content: 'Anti-raid mode triggered.' });
  } else {
    await app.db.execute('UPDATE gates SET state = \'verified\' WHERE guild_id = ?', [guild.id]);
    await v2MessageReply(message, { content: 'Anti-raid mode disarmed (gates reset).' });
  }
}

const command: BotCommand = {
  name: 'antiraid',
  category: 'admin',
  description: 'Manually trigger or disable anti-raid mode',
  data,
  permissions: ['ManageGuild'],
  aliases: ['raidmode'],
  execute,
  prefixExecute,
};

export default command;