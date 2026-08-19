import { SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction, Message } from 'discord.js';
import type { App } from '../../core/context';
import type { BotCommand } from '../../types/command';
import { v2Reply } from '../../utils/v2';
import { v2MessageReply } from '../../utils/v2';

const FLAGS: Record<string, string> = {
  t: 'Short time',
  T: 'Long time',
  d: 'Short date',
  D: 'Long date',
  f: 'Short date/time',
  F: 'Long date/time',
  R: 'Relative',
};

function timestampLines(ts: number): string {
  return ['**Timestamp generator**', ...Object.entries(FLAGS).map(([flag, label]) => `\`${flag}\` ${label}: <t:${ts}:${flag}>`)].join('\n');
}

const data = new SlashCommandBuilder()
  .setName('timestamp')
  .setDescription('Generate Discord timestamp codes for every format flag')
  .addStringOption((o) => o.setName('datetime').setDescription('Date/time string (default: now)').setRequired(false));

async function execute(interaction: ChatInputCommandInteraction, app: App): Promise<void> {
  await interaction.deferReply({ ephemeral: true });
  const input = interaction.options.getString('datetime');
  let ts: number;
  if (input) {
    const parsed = Date.parse(input);
    if (Number.isNaN(parsed)) {
      await v2Reply(interaction, 'Could not parse that date. Try ISO format, e.g. 2026-12-25 18:00.', { ephemeral: true });
      return;
    }
    ts = Math.floor(parsed / 1000);
  } else {
    ts = Math.floor(Date.now() / 1000);
  }

  await v2Reply(interaction, timestampLines(ts), { ephemeral: true });
}

async function prefixExecute(message: Message, args: string[], app: App): Promise<void> {
  const input = args.join(' ');
  const parsed = input ? Date.parse(input) : Date.now();
  if (Number.isNaN(parsed)) {
    await v2MessageReply(message, { content: 'Could not parse that date. Try ISO format, e.g. 2026-12-25 18:00.' });
    return;
  }
  const ts = Math.floor(parsed / 1000);
  await v2MessageReply(message, { content: timestampLines(ts) });
}

const command: BotCommand = {
  name: 'timestamp',
  category: 'utility',
  description: 'Generate Discord timestamp codes for every format flag',
  data,
  permissions: [],
  aliases: ['ts', 'time'],
  execute,
  prefixExecute,
};

export default command;