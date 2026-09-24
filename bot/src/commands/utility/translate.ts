import { SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction, Message } from 'discord.js';
import type { App } from '../../core/context';
import type { BotCommand } from '../../types/command';
import { v2Reply } from '../../utils/v2';
import { v2MessageReply } from '../../utils/v2';

async function translateResult(text: string, target: string): Promise<string> {
  const res = await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${target}&dt=t&q=${encodeURIComponent(text.slice(0, 1000))}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = (await res.json()) as unknown[];
  const translated = (json[0] as unknown[][]).map((seg) => seg[0]).join('');
  return `**Original:**\n${text.slice(0, 800)}\n\n**Translated (${target}):**\n${translated}`;
}

const data = new SlashCommandBuilder()
  .setName('translate')
  .setDescription('Translate text (free Google endpoint, no key required)')
  .addStringOption((o) => o.setName('text').setDescription('Text to translate').setRequired(true))
  .addStringOption((o) => o.setName('target').setDescription('Target language code, e.g. en, es, de').setRequired(false));

async function execute(interaction: ChatInputCommandInteraction, app: App): Promise<void> {
  await interaction.deferReply({ ephemeral: true });
  const text = interaction.options.getString('text', true);
  const target = interaction.options.getString('target') ?? 'en';
  try {
    await v2Reply(interaction, await translateResult(text, target), { ephemeral: true });
  } catch (err) {
    await v2Reply(interaction, `Translation failed: ${(err as Error).message}`, { ephemeral: true });
  }
}

async function prefixExecute(message: Message, args: string[], app: App): Promise<void> {
  const target = args[0]?.startsWith('-') ? args[0].slice(1) : 'en';
  const text = target === 'en' && !args[0]?.startsWith('-') ? args.join(' ') : args.slice(1).join(' ');
  if (!text) {
    await v2MessageReply(message, { content: 'Usage: `!translate <text>` or `!translate -<lang> <text>`' });
    return;
  }
  try {
    await v2MessageReply(message, { content: (await translateResult(text, target)).slice(0, 3800) });
  } catch (err) {
    await v2MessageReply(message, { content: `Translation failed: ${(err as Error).message}` });
  }
}

const command: BotCommand = {
  name: 'translate',
  category: 'utility',
  description: 'Translate text',
  usage: ['!translate <text>', '!translate -<lang> <text>'],
  details: 'Defaults to English as the target language; prefix a language code to choose another (e.g. `!translate -es hello`).',
  data,
  permissions: [],
  aliases: ['tr'],
  execute,
  prefixExecute,
};

export default command;