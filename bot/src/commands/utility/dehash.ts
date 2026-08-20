import { SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction, Message } from 'discord.js';
import type { App } from '../../core/context';
import type { BotCommand } from '../../types/command';
import { v2Reply } from '../../utils/v2';
import { v2MessageReply } from '../../utils/v2';
import * as crypto from 'crypto';

const ALGORITHMS = ['md5', 'sha1', 'sha224', 'sha256', 'sha384', 'sha512', 'sha3-256', 'sha3-512', 'ripemd160', 'whirlpool', 'blake2b512', 'blake2s256'].filter((a) =>
  crypto.getHashes().includes(a),
);

const LENGTH_TO_ALGOS: Record<number, string[]> = {};
for (const a of ALGORITHMS) {
  const len = crypto.createHash(a).update('').digest('hex').length;
  (LENGTH_TO_ALGOS[len] ??= []).push(a);
}

const WORDLIST = buildWordlist();

function buildWordlist(): string[] {
  const base = [
    'password', '123456', '12345678', '1234', 'qwerty', 'abc123', 'letmein', 'admin', 'welcome', 'monkey',
    'dragon', 'iloveyou', 'sunshine', 'princess', 'football', 'baseball', 'superman', 'batman', 'trustno1',
    'hello', 'world', 'test', 'guest', 'root', 'user', 'pass', 'secret', 'login', 'changeme', 'default',
    'shadow', 'master', 'shadow', 'azerty', 'password1', 'password123', 'qwerty123', '111111', '000000',
    'liverpool', 'maggie', 'charlie', 'andrew', 'matthew', 'jordan', 'tigger', 'brandon', 'compaq', 'harley',
    'ranger', 'iwantu', 'jennifer', 'hunter', 'freedom', 'buster', 'michael', 'cookie', 'internet', 'peace',
    'jackson', 'camera', 'computer', 'apple', 'microsoft', 'google', 'facebook', 'twitter', 'youtube', 'github',
    'discord', 'ninja', 'zaq12wsx', '!@#$%^&*', 'qazwsx', 'pa55w0rd', 'p@ssw0rd', 'passw0rd', 'admin123',
    'f34rless', 'fearless', 'moderation', 'hello123', 'welcome123', 'q1w2e3r4', '1q2w3e4r', 'starwars',
    'donald', 'jordan23', 'myspace', 'whatever', 'nothing', 'abcdef', 'abc12345', '123123', '12345', '1234567',
    'access', 'administrator', 'company', 'corporate', 'changethispassword', 'summer', 'winter', 'spring',
    'autumn', 'christmas', 'newyear', 'halloween', 'easter', 'birthday', 'valentine', 'mother', 'father',
    'family', 'friend', 'love', 'hate', 'happy', 'sad', 'angry', 'calm', 'cool', 'hot', 'cold', 'fire',
    'water', 'earth', 'wind', 'light', 'dark', 'sun', 'moon', 'star', 'sky', 'ocean', 'river', 'mountain',
    'forest', 'flower', 'tree', 'grass', 'snow', 'rain', 'storm', 'thunder', 'lightning', 'cloud', 'book',
    'music', 'movie', 'game', 'play', 'work', 'home', 'school', 'office', 'city', 'town', 'street', 'road',
    'car', 'bike', 'train', 'plane', 'boat', 'ship', 'dog', 'cat', 'bird', 'fish', 'horse', 'cow', 'pig',
    'sheep', 'lion', 'tiger', 'bear', 'wolf', 'fox', 'rabbit', 'mouse', 'snake', 'spider', 'bee', 'ant',
    'red', 'blue', 'green', 'yellow', 'orange', 'purple', 'pink', 'black', 'white', 'gray', 'brown', 'cyan',
    'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'zero', 'first', 'last',
    'open', 'close', 'start', 'stop', 'begin', 'end', 'yes', 'no', 'maybe', 'true', 'false', 'on', 'off',
    'data', 'info', 'secure', 'security', 'safe', 'protect', 'private', 'public', 'key', 'token', 'code',
    'hash', 'encrypt', 'decrypt', 'crypto', 'cipher', 'byte', 'bit', 'file', 'folder', 'system', 'network',
  ];
  const out = new Set<string>(base);
  for (const w of base) {
    out.add(w.toUpperCase());
    out.add(w.charAt(0).toUpperCase() + w.slice(1));
    out.add(`${w}123`);
    out.add(`${w}1`);
    out.add(`${w}2023`);
    out.add(`${w}2024`);
    out.add(`123${w}`);
    out.add(`${w}!`);
    out.add(`${w}@`);
    for (let i = 0; i <= 99; i++) out.add(`${w}${i}`);
  }
  return [...out];
}

function dehash(target: string, algos: string[]): string[] {
  const matches: string[] = [];
  for (const algo of algos) {
    for (const word of WORDLIST) {
      const h = crypto.createHash(algo).update(word).digest('hex');
      if (h === target) matches.push(`${word} (${algo})`);
    }
  }
  return matches;
}

function resolveAlgos(explicit: string | undefined, target: string): string[] {
  if (explicit) {
    const a = explicit.toLowerCase();
    if (!ALGORITHMS.includes(a)) return [];
    return [a];
  }
  return LENGTH_TO_ALGOS[target.length] ?? [];
}

const data = new SlashCommandBuilder()
  .setName('dehash')
  .setDescription('Attempt to reverse a hash via a built-in rainbow table (common words/passwords only)')
  .addStringOption((o) => o.setName('hash').setDescription('The hash to attempt to crack').setRequired(true))
  .addStringOption((o) =>
    o
      .setName('algorithm')
      .setDescription('Algorithm (optional, auto-detected from length)')
      .addChoices(...ALGORITHMS.map((a) => ({ name: a, value: a })))
      .setRequired(false),
  );

async function execute(interaction: ChatInputCommandInteraction, app: App): Promise<void> {
  const target = interaction.options.getString('hash', true).trim().toLowerCase();
  const explicit = interaction.options.getString('algorithm') ?? undefined;
  const algos = resolveAlgos(explicit, target);
  if (algos.length === 0) {
    await v2Reply(interaction, `❌ Could not determine a supported algorithm for that hash${explicit ? ` (\`${explicit}\` unsupported)` : ''}.`, { ephemeral: true });
    return;
  }
  const matches = dehash(target, algos);
  const content =
    matches.length > 0
      ? `✅ Found ${matches.length} match(es):\n${matches.slice(0, 25).map((m) => `- \`${m}\``).join('\n')}`
      : `❌ No match found in the built-in rainbow table.\n_Hashes are one-way; this only works for known/common strings._`;
  await v2Reply(interaction, content, { ephemeral: true });
}

async function prefixExecute(message: Message, args: string[], app: App): Promise<void> {
  if (args.length === 0) {
    await v2MessageReply(message, { content: 'Usage: `!dehash [algorithm] <hash>`' });
    return;
  }
  let explicit: string | undefined;
  if (ALGORITHMS.includes(args[0].toLowerCase())) {
    explicit = args.shift()!.toLowerCase();
  }
  const target = args.join('').trim().toLowerCase();
  if (!target) {
    await v2MessageReply(message, { content: 'Usage: `!dehash [algorithm] <hash>`' });
    return;
  }
  const algos = resolveAlgos(explicit, target);
  if (algos.length === 0) {
    await v2MessageReply(message, { content: `❌ Could not determine a supported algorithm for that hash${explicit ? ` (\`${explicit}\` unsupported)` : ''}.` });
    return;
  }
  const matches = dehash(target, algos);
  const content =
    matches.length > 0
      ? `✅ Found ${matches.length} match(es):\n${matches.slice(0, 25).map((m) => `- \`${m}\``).join('\n')}`
      : `❌ No match found in the built-in rainbow table.\n_Hashes are one-way; this only works for known/common strings._`;
  await v2MessageReply(message, { content });
}

const command: BotCommand = {
  name: 'dehash',
  category: 'utility',
  description: 'Attempt to reverse a hash via a built-in rainbow table',
  data,
  permissions: [],
  aliases: ['uncrack', 'rainbow'],
  execute,
  prefixExecute,
};

export default command;
