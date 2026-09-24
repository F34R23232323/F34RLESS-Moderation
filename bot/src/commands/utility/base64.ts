import { SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction, Message } from 'discord.js';
import type { App } from '../../core/context';
import type { BotCommand } from '../../types/command';
import { v2Reply } from '../../utils/v2';
import { v2MessageReply } from '../../utils/v2';

function base64Result(mode: 'encode' | 'decode', text: string): string {
  const result = mode === 'encode' ? Buffer.from(text).toString('base64') : Buffer.from(text, 'base64').toString('utf8');
  return `\`${result.slice(0, 1500)}\``;
}

const data = new SlashCommandBuilder()
  .setName('base64')
  .setDescription('Base64 encode/decode')
  .addStringOption((o) => o.setName('mode').setDescription('encode or decode').addChoices({ name: 'encode', value: 'encode' }, { name: 'decode', value: 'decode' }).setRequired(true))
  .addStringOption((o) => o.setName('text').setDescription('Text').setRequired(true));

async function execute(interaction: ChatInputCommandInteraction, app: App): Promise<void> {
  const mode = interaction.options.getString('mode', true) as 'encode' | 'decode';
  const text = interaction.options.getString('text', true);
  await v2Reply(interaction, base64Result(mode, text), { ephemeral: true });
}

async function prefixExecute(message: Message, args: string[], app: App): Promise<void> {
  const mode = (args[0] ?? 'encode') as 'encode' | 'decode';
  const text = args.slice(1).join(' ');
  if (!text) {
    await v2MessageReply(message, { content: 'Usage: `!base64 <encode|decode> <text>`' });
    return;
  }
  await v2MessageReply(message, { content: base64Result(mode, text) });
}

const command: BotCommand = {
  name: 'base64',
  category: 'utility',
  description: 'Base64 encode/decode',
  usage: '!base64 <encode|decode> <text>',
  data,
  permissions: [],
  aliases: ['b64'],
  execute,
  prefixExecute,
};

export default command;