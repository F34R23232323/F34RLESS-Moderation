import { SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction, Message, TextChannel } from 'discord.js';
import type { App } from '../../core/context';
import type { BotCommand } from '../../types/command';
import { v2Reply } from '../../utils/v2';
import { v2MessageReply } from '../../utils/v2';

const data = new SlashCommandBuilder()
  .setName('lock')
  .setDescription('Lock a channel (denies SendMessages for everyone)')
  .addChannelOption((o) => o.setName('channel').setDescription('Channel to lock (defaults to current)').setRequired(false));

async function execute(interaction: ChatInputCommandInteraction, app: App): Promise<void> {
  await interaction.deferReply({ ephemeral: true });
  const channel = interaction.options.getChannel('channel') ?? interaction.channel;
  if (!channel || !('permissionOverwrites' in channel)) {
    await v2Reply(interaction, 'That channel cannot be locked.', { ephemeral: true });
    return;
  }
  const result = await app.lockingService.lockChannel(channel as TextChannel, `Locked by ${interaction.user.tag}`);
  if (!result.ok) {
    await v2Reply(interaction, `Failed: ${result.error}`, { ephemeral: true });
    return;
  }
  await v2Reply(interaction, `Locked <#${channel.id}>.`);
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

  const result = await app.lockingService.lockChannel(channel, `Locked by ${message.author.tag}`);
  if (!result.ok) {
    await v2MessageReply(message, { content: `Failed: ${result.error}` });
    return;
  }
  await v2MessageReply(message, { content: `Locked <#${channel.id}>.` });
}

const command: BotCommand = {
  name: 'lock',
  category: 'moderation',
  description: 'Lock a channel (denies SendMessages for everyone)',
  data,
  permissions: ['ManageChannels'],
  aliases: ['lockdown'],
  execute,
  prefixExecute,
};

export default command;
