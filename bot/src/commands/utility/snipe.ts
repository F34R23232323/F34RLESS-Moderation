import { SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction, Message } from 'discord.js';
import type { App } from '../../core/context';
import type { BotCommand } from '../../types/command';
import type { SnipeEntry, SnipeAttachment } from '../../utils/snipe';
import { v2Reply, v2MessageReply } from '../../utils/v2';

function formatEntry(entry: SnipeEntry, index: number): string {
  const time = `<t:${Math.floor(entry.timestamp / 1000)}:R>`;
  let text = `**#${index}** — ${entry.authorName} ${time}\n`;
  if (entry.content) text += entry.content.slice(0, 1000);
  if (entry.attachments.length > 0) {
    if (entry.content) text += '\n';
    text += entry.attachments.map((a) => `📎 [${a.name}](${a.url})`).join('\n');
  }
  return text;
}

function formatEntries(entries: SnipeEntry[], emptyMsg: string): string {
  if (entries.length === 0) return emptyMsg;
  return entries.map((e, i) => formatEntry(e, i + 1)).join('\n\n');
}

function parsePrefixArgs(args: string[]): { sub: string; amount: number } {
  let sub = 'messages';
  let amount = 1;
  for (const arg of args) {
    const num = parseInt(arg, 10);
    if (!isNaN(num) && num > 0) {
      amount = Math.min(num, 10);
    } else if (['messages', 'edits', 'attachments', 'edited', 'deleted', 'attach'].includes(arg.toLowerCase())) {
      const alias: Record<string, string> = { deleted: 'messages', edited: 'edits', attach: 'attachments' };
      sub = alias[arg.toLowerCase()] ?? arg.toLowerCase();
    }
  }
  return { sub, amount };
}

const data = new SlashCommandBuilder()
  .setName('snipe')
  .setDescription('Recall deleted messages, edits, and attachments')
  .addSubcommand((s) =>
    s
      .setName('messages')
      .setDescription('Show recently deleted messages')
      .addIntegerOption((o) => o.setName('amount').setDescription('Number of messages to recall (1-10)').setMinValue(1).setMaxValue(10).setRequired(false)),
  )
  .addSubcommand((s) =>
    s
      .setName('edits')
      .setDescription('Show recently edited messages')
      .addIntegerOption((o) => o.setName('amount').setDescription('Number of edits to recall (1-10)').setMinValue(1).setMaxValue(10).setRequired(false)),
  )
  .addSubcommand((s) =>
    s
      .setName('attachments')
      .setDescription('Show recently deleted messages that had attachments')
      .addIntegerOption((o) => o.setName('amount').setDescription('Number of entries to show (1-10)').setMinValue(1).setMaxValue(10).setRequired(false)),
  );

async function execute(interaction: ChatInputCommandInteraction, app: App): Promise<void> {
  await interaction.deferReply({ ephemeral: true });
  const sub = interaction.options.getSubcommand();
  const amount = interaction.options.getInteger('amount') ?? 1;
  const retentionMs = app.config.ops.snipe_retention_seconds * 1000;
  const { getDeleted, getEdited, getDeletedAttachments } = await import('../../utils/snipe');

  let entries: SnipeEntry[];
  let emptyMsg: string;

  switch (sub) {
    case 'messages':
      entries = getDeleted(interaction.channelId, retentionMs, amount);
      emptyMsg = 'No deleted messages found to snipe.';
      break;
    case 'edits':
      entries = getEdited(interaction.channelId, retentionMs, amount);
      emptyMsg = 'No edited messages found to snipe.';
      break;
    case 'attachments':
      entries = getDeletedAttachments(interaction.channelId, retentionMs, amount);
      emptyMsg = 'No deleted messages with attachments found to snipe.';
      break;
    default:
      entries = [];
      emptyMsg = 'Unknown subcommand.';
  }

  await v2Reply(interaction, formatEntries(entries, emptyMsg), { ephemeral: true });
}

async function prefixExecute(message: Message, args: string[], app: App): Promise<void> {
  const { sub, amount } = parsePrefixArgs(args);
  const retentionMs = app.config.ops.snipe_retention_seconds * 1000;
  const { getDeleted, getEdited, getDeletedAttachments } = await import('../../utils/snipe');

  let entries: SnipeEntry[];
  let emptyMsg: string;

  switch (sub) {
    case 'messages':
      entries = getDeleted(message.channelId, retentionMs, amount);
      emptyMsg = 'No deleted messages found to snipe.';
      break;
    case 'edits':
      entries = getEdited(message.channelId, retentionMs, amount);
      emptyMsg = 'No edited messages found to snipe.';
      break;
    case 'attachments':
      entries = getDeletedAttachments(message.channelId, retentionMs, amount);
      emptyMsg = 'No deleted messages with attachments found to snipe.';
      break;
    default:
      entries = getDeleted(message.channelId, retentionMs, amount);
      emptyMsg = 'No deleted messages found to snipe.';
  }

  const content = formatEntries(entries, emptyMsg);
  if (content.length > 2000) {
    const chunks: string[] = [];
    let remaining = content;
    while (remaining.length > 0) {
      if (remaining.length <= 2000) {
        chunks.push(remaining);
        break;
      }
      const splitAt = remaining.lastIndexOf('\n\n', 2000);
      chunks.push(remaining.slice(0, splitAt > 0 ? splitAt : 2000));
      remaining = remaining.slice(splitAt > 0 ? splitAt + 2 : 2000);
    }
    for (const chunk of chunks) {
      await v2MessageReply(message, { content: chunk });
    }
  } else {
    await v2MessageReply(message, { content });
  }
}

const command: BotCommand = {
  name: 'snipe',
  category: 'utility',
  description: 'Recall deleted messages, edits, and attachments',
  data,
  permissions: ['ManageMessages'],
  aliases: ['s'],
  execute,
  prefixExecute,
};

export default command;
