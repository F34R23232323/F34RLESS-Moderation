import { SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction, Message } from 'discord.js';
import type { App } from '../../core/context';
import type { BotCommand } from '../../types/command';
import { v2Reply } from '../../utils/v2';
import { v2MessageReply } from '../../utils/v2';
import * as crypto from 'crypto';

const ALL_HASHES = crypto.getHashes();
const ALGORITHMS = ['md5', 'sha1', 'sha224', 'sha256', 'sha384', 'sha512', 'sha3-256', 'sha3-512', 'ripemd160', 'whirlpool', 'blake2b512', 'blake2s256'].filter((a) =>
  ALL_HASHES.includes(a),
);

function hashResult(algorithm: string, text: string): string {
  let hex: string;
  try {
    hex = crypto.createHash(algorithm).update(text).digest('hex');
  } catch {
    return `❌ Digest method \`${algorithm}\` is not supported on this system.`;
  }
  return `**${algorithm}**\n\`\`\`\n${hex}\n\`\`\``;
}

function formatHashes(text: string): string {
  return ALGORITHMS.map((algo) => {
    const hex = crypto.createHash(algo).update(text).digest('hex');
    return `**${algo}**: \`${hex}\``;
  }).join('\n');
}

const data = new SlashCommandBuilder()
  .setName('hash')
  .setDescription('Hash a string with one or all supported algorithms')
  .addStringOption((o) =>
    o
      .setName('text')
      .setDescription('Text to hash')
      .setRequired(true),
  )
  .addStringOption((o) =>
    o
      .setName('algorithm')
      .setDescription('Specific algorithm (defaults to all)')
      .addChoices(...ALGORITHMS.map((a) => ({ name: a, value: a })))
      .setRequired(false),
  );

async function execute(interaction: ChatInputCommandInteraction, app: App): Promise<void> {
  const text = interaction.options.getString('text', true);
  const algorithm = interaction.options.getString('algorithm');
  const content = algorithm ? hashResult(algorithm, text) : formatHashes(text);
  await v2Reply(interaction, content, { ephemeral: true });
}

async function prefixExecute(message: Message, args: string[], app: App): Promise<void> {
  if (args.length === 0) {
    await v2MessageReply(message, { content: 'Usage: `!hash [algorithm] <text>` — omit algorithm to show all.' });
    return;
  }

  let algorithm: string | undefined;
  if (ALGORITHMS.includes(args[0].toLowerCase())) {
    algorithm = args[0].toLowerCase();
    args.shift();
  }

  const text = args.join(' ').trim();
  if (!text) {
    await v2MessageReply(message, { content: 'Usage: `!hash [algorithm] <text>` — omit algorithm to show all.' });
    return;
  }

  const content = algorithm ? hashResult(algorithm, text) : formatHashes(text);
  await v2MessageReply(message, { content });
}

const command: BotCommand = {
  name: 'hash',
  category: 'utility',
  description: 'Hash a string with md5, sha1, sha256 and more',
  usage: '!hash [algorithm] <text>',
  details: 'Omit the algorithm to print every supported hash at once.',
  data,
  permissions: [],
  aliases: [],
  execute,
  prefixExecute,
};

export default command;
