import { SlashCommandBuilder, ChannelType } from 'discord.js';
import type { ChatInputCommandInteraction, Guild, Message, TextBasedChannel } from 'discord.js';
import type { App } from '../../core/context';
import type { BotCommand } from '../../types/command';
import { v2Reply } from '../../utils/v2';
import { v2MessageReply } from '../../utils/v2';

const data = new SlashCommandBuilder()
  .setName('archive')
  .setDescription('Archive recent messages to the dashboard with a shareable link')
  .addIntegerOption((o) => o.setName('amount').setDescription('Number of messages to archive').setMinValue(1).setMaxValue(2000).setRequired(false))
  .addUserOption((o) => o.setName('user').setDescription('Only archive messages from this user').setRequired(false))
  .addChannelOption((o) => o.setName('channel').setDescription('Channel to archive (defaults to this one)').addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement, ChannelType.PublicThread, ChannelType.PrivateThread).setRequired(false));

async function archiveFrom(
  app: App,
  guild: Guild,
  channel: TextBasedChannel,
  amount: number,
  userId: string | null,
  actorId: string,
): Promise<{ ok: boolean; link?: string; count?: number; error?: string }> {
  const cap = Math.min(amount, app.config.archives.max_amount);
  const result = await app.archives.archiveChannel({
    guild,
    channel,
    amount: cap,
    userId,
    createdBy: actorId,
    kind: 'manual',
  });
  if (!result) return { ok: false, error: 'No messages found to archive.' };
  return { ok: true, link: result.link, count: result.messageCount };
}

async function execute(interaction: ChatInputCommandInteraction, app: App): Promise<void> {
  await interaction.deferReply({ ephemeral: true });
  const guild = interaction.guild;
  if (!guild) return;
  const amount = interaction.options.getInteger('amount') ?? app.config.archives.default_amount;
  const target = interaction.options.getUser('user');
  const channelOpt = interaction.options.getChannel('channel');
  const channel = (channelOpt && 'messages' in channelOpt ? channelOpt : interaction.channel) as TextBasedChannel;
  if (!channel || !('messages' in channel)) {
    await v2Reply(interaction, 'That channel cannot be archived.', { ephemeral: true });
    return;
  }
  const result = await archiveFrom(app, guild, channel, amount, target?.id ?? null, interaction.user.id);
  if (!result.ok) {
    await v2Reply(interaction, `Failed: ${result.error}`, { ephemeral: true });
    return;
  }
  await v2Reply(interaction, `Archived ${result.count} message(s) in <#${channel.id}> — ${result.link}`, { ephemeral: true });
}

async function prefixExecute(message: Message, args: string[], app: App): Promise<void> {
  const guild = message.guild;
  if (!guild || !message.inGuild()) return;
  const amount = parseInt(args[0] ?? '', 10);
  if (!amount || amount < 1 || amount > app.config.archives.max_amount) {
    await v2MessageReply(message, {
      content: `Usage: \`!archive <amount 1-${app.config.archives.max_amount}> [user] [channel]\``,
    });
    return;
  }
  let userId: string | null = null;
  let channel = message.channel as TextBasedChannel;
  for (const arg of args.slice(1)) {
    if (/^<#\d+>$/.test(arg)) {
      const id = arg.replace(/[<#>]/g, '');
      const resolved = guild.channels.cache.get(id);
      if (resolved && 'messages' in resolved) channel = resolved as TextBasedChannel;
    } else if (/^<@!?\d+>$/.test(arg) || /^\d{17,20}$/.test(arg)) {
      userId = arg.replace(/[<@!>]/g, '');
    }
  }
  const result = await archiveFrom(app, guild, channel, amount, userId, message.author.id);
  const sent = await v2MessageReply(message, {
    content: result.ok ? `Archived ${result.count} message(s) in <#${channel.id}> — ${result.link}` : `Failed: ${result.error}`,
  });
  setTimeout(() => sent.delete().catch(() => undefined), 15_000);
}

const command: BotCommand = {
  name: 'archive',
  category: 'moderation',
  description: 'Archive recent messages to the dashboard with a shareable link',
  data,
  permissions: ['ManageMessages'],
  aliases: ['a', 'arch'],
  execute,
  prefixExecute,
};

export default command;
