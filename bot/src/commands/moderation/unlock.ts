import { SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction, Message, TextChannel } from 'discord.js';
import type { App } from '../../core/context';
import type { BotCommand } from '../../types/command';
import { v2Reply } from '../../utils/v2';
import { v2MessageReply } from '../../utils/v2';

const data = new SlashCommandBuilder()
  .setName('unlock')
  .setDescription('Unlock a channel (restores previous permissions)')
  .addChannelOption((o) => o.setName('channel').setDescription('Channel to unlock (defaults to current)').setRequired(false));

async function execute(interaction: ChatInputCommandInteraction, app: App): Promise<void> {
  await interaction.deferReply({ ephemeral: true });
  const channel = interaction.options.getChannel('channel') ?? interaction.channel;
  if (!channel || !('permissionOverwrites' in channel)) {
    await v2Reply(interaction, 'That channel cannot be unlocked.', { ephemeral: true });
    return;
  }
  const result = await app.lockingService.unlockChannel(channel as TextChannel, `Unlocked by ${interaction.user.tag}`);
  if (!result.ok) {
    await v2Reply(interaction, `Failed: ${result.error}`, { ephemeral: true });
    return;
  }
  await v2Reply(interaction, `Unlocked <#${channel.id}>.`);
}

async function prefixExecute(message: Message, args: string[], app: App): Promise<void> {
  const guild = message.guild;
  if (!guild) return;

  let channel = message.channel as TextChannel;
  if (args[0]) {
    const id = args[0].replace(/[<#>]/g, '');
    const resolved = guild.channels.cache.get(id);
    if (!resolved || !('permissionOverwrites' in resolved)) {
      await v2MessageReply(message, { content: 'Channel not found.' });
      return;
    }
    channel = resolved as TextChannel;
  }

  const result = await app.lockingService.unlockChannel(channel, `Unlocked by ${message.author.tag}`);
  if (!result.ok) {
    await v2MessageReply(message, { content: `Failed: ${result.error}` });
    return;
  }
  await v2MessageReply(message, { content: `Unlocked <#${channel.id}>.` });
}

const command: BotCommand = {
  name: 'unlock',
  category: 'moderation',
  description: 'Unlock a channel (restores previous permissions)',
  data,
  permissions: ['ManageChannels'],
  aliases: [],
  execute,
  prefixExecute,
};

export default command;
