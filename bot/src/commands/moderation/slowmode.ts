import { SlashCommandBuilder, ChannelType, PermissionFlagsBits } from 'discord.js';
import type { ChatInputCommandInteraction, Message, TextChannel } from 'discord.js';
import type { App } from '../../core/context';
import type { BotCommand } from '../../types/command';
import { parseDuration, isNativeSlowmode } from '../../management/customSlowmode';
import { v2Reply, v2MessageReply } from '../../utils/v2';

const MAX_SLOWMODE_SECONDS = 21_600;

function formatDurationShort(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (seconds > 0 && parts.length === 0) parts.push(`${seconds}s`);
  return parts.join(' ') || '0s';
}

const data = new SlashCommandBuilder()
  .setName('slowmode')
  .setDescription('Set or remove slowmode on a channel')
  .addSubcommand((s) =>
    s
      .setName('set')
      .setDescription('Set slowmode on a channel')
      .addStringOption((o) => o.setName('duration').setDescription('Duration (e.g. 30s, 5m, 1h, 1d, 1w)').setRequired(true))
      .addChannelOption((o) =>
        o
          .setName('channel')
          .setDescription('Channel to set slowmode on (defaults to current)')
          .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
          .setRequired(false),
      ),
  )
  .addSubcommand((s) =>
    s
      .setName('remove')
      .setDescription('Remove slowmode from a channel')
      .addChannelOption((o) =>
        o
          .setName('channel')
          .setDescription('Channel to remove slowmode from (defaults to current)')
          .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
          .setRequired(false),
      ),
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels);

async function execute(interaction: ChatInputCommandInteraction, app: App): Promise<void> {
  await interaction.deferReply({ ephemeral: true });
  const sub = interaction.options.getSubcommand();
  const channelOpt = interaction.options.getChannel('channel');
  const targetChannel = (channelOpt && 'setRateLimitPerUser' in channelOpt ? channelOpt : interaction.channel) as TextChannel;

  if (!targetChannel || !('setRateLimitPerUser' in targetChannel)) {
    await v2Reply(interaction, 'That channel does not support slowmode.', { ephemeral: true });
    return;
  }

  if (sub === 'remove') {
    const removed = app.customSlowmode.remove(targetChannel.id);
    await targetChannel.setRateLimitPerUser(0, `Slowmode removed by ${interaction.user.tag}`).catch(() => undefined);
    const msg = removed ? `Removed custom slowmode from <#${targetChannel.id}>.` : `Cleared native slowmode on <#${targetChannel.id}>.`;
    await v2Reply(interaction, msg, { ephemeral: true });
    return;
  }

  const durationInput = interaction.options.getString('duration', true);
  const durationMs = parseDuration(durationInput);
  if (!durationMs || durationMs < 1000) {
    await v2Reply(interaction, 'Invalid duration. Use formats like `30s`, `5m`, `1h`, `1d`, `1w`, or a number of seconds.', { ephemeral: true });
    return;
  }

  if (isNativeSlowmode(durationMs)) {
    const seconds = Math.floor(durationMs / 1000);
    app.customSlowmode.remove(targetChannel.id);
    await targetChannel.setRateLimitPerUser(seconds, `Slowmode set by ${interaction.user.tag}`);
    await v2Reply(interaction, `Set slowmode on <#${targetChannel.id}> to **${formatDurationShort(durationMs)}** (${seconds}s — native Discord).`, { ephemeral: true });
    return;
  }

  app.customSlowmode.set(targetChannel.id, durationMs, interaction.user.id);
  await targetChannel.setRateLimitPerUser(0, 'Clearing native slowmode for custom slowmode').catch(() => undefined);
  await v2Reply(
    interaction,
    `Set custom slowmode on <#${targetChannel.id}> to **${formatDurationShort(durationMs)}**.\nMessages sent within this window will be automatically deleted. This exceeds Discord's native limit of ${MAX_SLOWMODE_SECONDS}s.`,
    { ephemeral: true },
  );
}

async function prefixExecute(message: Message, args: string[], app: App): Promise<void> {
  if (args[0] === 'remove' || args[0] === 'clear' || args[0] === 'off') {
    let channel = message.channel as TextChannel;
    const channelArg = args[1];
    if (channelArg) {
      const id = channelArg.replace(/[<#>]/g, '');
      const resolved = message.guild?.channels.cache.get(id);
      if (resolved && 'setRateLimitPerUser' in resolved) channel = resolved as TextChannel;
    }
    const removed = app.customSlowmode.remove(channel.id);
    await channel.setRateLimitPerUser(0, `Slowmode removed by ${message.author.tag}`).catch(() => undefined);
    await v2MessageReply(message, {
      content: removed ? `Removed custom slowmode from <#${channel.id}>.` : `Cleared native slowmode on <#${channel.id}>.`,
    });
    return;
  }

  const durationInput = args[0];
  if (!durationInput) {
    await v2MessageReply(message, {
      content: 'Usage: `!slowmode <duration> [channel]` or `!slowmode remove [channel]`\nDuration examples: `30s`, `5m`, `1h`, `1d`, `1w`',
    });
    return;
  }

  const durationMs = parseDuration(durationInput);
  if (!durationMs || durationMs < 1000) {
    await v2MessageReply(message, {
      content: 'Invalid duration. Use formats like `30s`, `5m`, `1h`, `1d`, `1w`, or a number of seconds.',
    });
    return;
  }

  let channel = message.channel as TextChannel;
  const channelArg = args[1];
  if (channelArg) {
    const id = channelArg.replace(/[<#>]/g, '');
    const resolved = message.guild?.channels.cache.get(id);
    if (resolved && 'setRateLimitPerUser' in resolved) channel = resolved as TextChannel;
  }

  if (isNativeSlowmode(durationMs)) {
    const seconds = Math.floor(durationMs / 1000);
    app.customSlowmode.remove(channel.id);
    await channel.setRateLimitPerUser(seconds, `Slowmode set by ${message.author.tag}`);
    await v2MessageReply(message, {
      content: `Set slowmode on <#${channel.id}> to **${formatDurationShort(durationMs)}** (${seconds}s — native Discord).`,
    });
  } else {
    app.customSlowmode.set(channel.id, durationMs, message.author.id);
    await channel.setRateLimitPerUser(0, 'Clearing native slowmode for custom slowmode').catch(() => undefined);
    await v2MessageReply(message, {
      content: `Set custom slowmode on <#${channel.id}> to **${formatDurationShort(durationMs)}**.\nMessages sent within this window will be automatically deleted. This exceeds Discord's native limit of ${MAX_SLOWMODE_SECONDS}s.`,
    });
  }
}

const command: BotCommand = {
  name: 'slowmode',
  category: 'moderation',
  description: 'Set or remove slowmode on a channel',
  usage: ['!slowmode <duration> [channel]', '!slowmode remove [channel]'],
  details: 'Durations up to 6h use native Discord slowmode; longer durations use the bot custom slowmode, which deletes messages sent within the window.',
  data,
  permissions: ['ManageChannels'],
  aliases: ['sm'],
  execute,
  prefixExecute,
};

export default command;
