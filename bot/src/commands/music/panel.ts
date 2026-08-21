import { SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction, Message } from 'discord.js';
import type { App } from '../../core/context';
import type { BotCommand } from '../../types/command';
import { v2Reply, v2MessageReply } from '../../utils/v2';
import { getQueue } from '../../music/helpers';

const data = new SlashCommandBuilder().setName('panel').setDescription('Spawn the music control panel in this channel');

async function run(app: App, guildId: string, channelId: string): Promise<string> {
  await app.music.updateSettings(guildId, { textChannelId: channelId });
  await app.music.refreshPanel(guildId, getQueue(app, guildId));
  return '🎵 Music control panel sent to this channel.';
}

async function execute(interaction: ChatInputCommandInteraction, app: App): Promise<void> {
  const guild = interaction.guild;
  if (!guild) return;
  if (!interaction.channel || !interaction.channel.isTextBased()) {
    await v2Reply(interaction, 'You must run this in a text channel.', { ephemeral: true });
    return;
  }
  await v2Reply(interaction, await run(app, guild.id, interaction.channel.id));
}

async function prefixExecute(message: Message, _args: string[], app: App): Promise<void> {
  const guild = message.guild;
  if (!guild) return;
  await v2MessageReply(message, { content: await run(app, guild.id, message.channel.id) });
}

const command: BotCommand = {
  name: 'panel',
  category: 'music',
  description: 'Spawn the music control panel',
  data,
  permissions: [],
  aliases: ['music'],
  execute,
  prefixExecute,
};

export default command;