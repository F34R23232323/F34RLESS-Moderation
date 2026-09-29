import { SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction, Message } from 'discord.js';
import type { App } from '../../core/context';
import type { BotCommand } from '../../types/command';
import { v2Reply } from '../../utils/v2';
import { v2MessageReply } from '../../utils/v2';
import { sendConfirmation } from '../../components/moderation';

async function performPurge(
  app: App,
  actorId: string,
  guildId: string,
  channel: any,
  amount: number,
  opts: { targetUserId?: string | null; contains?: string | null; bots?: boolean; attachments?: boolean; excludeId?: string },
): Promise<number> {
  const fetched = await channel.messages.fetch({ limit: Math.min(amount + 10, 100) });
  const selected = fetched.filter((m: any) => {
    if (m.id === opts.excludeId) return false;
    if (opts.targetUserId && m.author.id !== opts.targetUserId) return false;
    if (opts.contains && !m.content.includes(opts.contains)) return false;
    if (opts.bots && !m.author.bot) return false;
    if (opts.attachments && m.attachments.size === 0) return false;
    return true;
  }).first(amount);

  const count = selected.length;
  const ids = selected.map((m: any) => m.id);
  try {
    await channel.bulkDelete(ids, true);
  } catch {
    for (const m of selected) await m.delete().catch(() => undefined);
  }

  await app.logManager.log({
    event: 'moderation_action',
    guildId,
    channelId: channel.id,
    actorId,
    message: `Purged ${count} messages in <#${channel.id}>`,
    details: { amount: count, filters: { targetUser: opts.targetUserId, contains: opts.contains, bots: opts.bots, attachments: opts.attachments } },
  });

  return count;
}

const data = new SlashCommandBuilder()
  .setName('purge')
  .setDescription('Purge messages with optional filters')
  .addIntegerOption((o) => o.setName('amount').setDescription('Number of messages').setMinValue(1).setMaxValue(100).setRequired(true))
  .addUserOption((o) => o.setName('user').setDescription('Only purge from this user').setRequired(false))
  .addStringOption((o) => o.setName('contains').setDescription('Only purge messages containing this text').setRequired(false))
  .addBooleanOption((o) => o.setName('bots').setDescription('Only purge bot messages').setRequired(false))
  .addBooleanOption((o) => o.setName('attachments').setDescription('Only purge messages with attachments').setRequired(false));

async function execute(interaction: ChatInputCommandInteraction, app: App): Promise<void> {
  await interaction.deferReply({ ephemeral: true });
  const channel = interaction.channel;
  if (!channel || !('bulkDelete' in channel)) return;
  const amount = interaction.options.getInteger('amount', true);
  const targetUser = interaction.options.getUser('user');
  const contains = interaction.options.getString('contains');
  const bots = interaction.options.getBoolean('bots') ?? false;
  const attachments = interaction.options.getBoolean('attachments') ?? false;

  const filters: string[] = [];
  if (targetUser) filters.push(`user: ${targetUser.username}`);
  if (contains) filters.push(`contains: "${contains}"`);
  if (bots) filters.push('bots only');
  if (attachments) filters.push('attachments only');
  const filterStr = filters.length ? `\nFilters: ${filters.join(', ')}` : '';

  await sendConfirmation(interaction, {
    action: 'purge',
    display: `Purge ${amount} messages`,
    targetUserId: targetUser?.id ?? interaction.user.id,
    reason: `Purge ${amount} messages in <#${channel.id}>${filterStr}`,
    guildId: interaction.guildId!,
    channelId: channel.id,
    actorId: interaction.user.id,
    purgeAmount: amount,
    purgeUserId: targetUser?.id ?? null,
  });
}

async function prefixExecute(message: Message, args: string[], app: App): Promise<void> {
  const amount = parseInt(args[0] ?? '', 10);
  if (!amount || amount < 1 || amount > 100) {
    await v2MessageReply(message, { content: 'Usage: `!purge <1-100> [user] [contains:text] [bots] [attachments]`' });
    return;
  }
  const channel = message.channel;
  if (!('bulkDelete' in channel)) return;
  let targetUserId: string | null = null;
  let contains: string | null = null;
  let bots = false;
  let attachments = false;
  for (const arg of args.slice(1)) {
    if (/^<@!?\d+>$/.test(arg) || /^\d{17,20}$/.test(arg)) targetUserId = arg.replace(/[<@!>]/g, '');
    else if (arg.toLowerCase().startsWith('contains:')) contains = arg.slice('contains:'.length) || null;
    else if (arg.toLowerCase() === 'bots') bots = true;
    else if (arg.toLowerCase() === 'attachments') attachments = true;
  }

  const filters: string[] = [];
  if (targetUserId) filters.push(`user: <@${targetUserId}>`);
  if (contains) filters.push(`contains: "${contains}"`);
  if (bots) filters.push('bots only');
  if (attachments) filters.push('attachments only');
  const filterStr = filters.length ? `\nFilters: ${filters.join(', ')}` : '';

  const { sendButtonConfirm } = await import('../../components/moderation');
  const { confirmed } = await sendButtonConfirm(app, message, 'purge', targetUserId ?? message.id, `Purge ${amount} messages${filterStr}`);
  if (!confirmed) return;

  const count = await performPurge(app, message.author.id, message.guildId!, channel, amount, {
    targetUserId, contains, bots, attachments, excludeId: message.id,
  });
  const reply = await (message.channel as any).send({ content: `Purged ${count} message(s).`, allowedMentions: { parse: [] } }).catch(() => undefined);
  if (reply) setTimeout(() => reply.delete().catch(() => undefined), 3000);
}

const command: BotCommand = {
  name: 'purge', category: 'moderation', description: 'Purge messages with optional filters',
  usage: '!purge <1-100> [user] [contains:text] [bots] [attachments]',
  details: 'Deletes up to 100 recent messages, optionally filtered by author, `contains:text`, `bots`, or `attachments`. Requires a confirmation button.',
  data, permissions: ['ManageMessages'], aliases: ['clear', 'prune'], execute, prefixExecute,
};

export default command;
