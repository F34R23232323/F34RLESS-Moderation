import { SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction, Message } from 'discord.js';
import type { App } from '../../core/context';
import type { BotCommand } from '../../types/command';
import { v2Reply } from '../../utils/v2';

const data = new SlashCommandBuilder()
  .setName('calculator')
  .setDescription('Evaluate a math expression')
  .addStringOption((o) => o.setName('expression').setDescription('Expression, e.g. 2+2*10').setRequired(true));

async function execute(interaction: ChatInputCommandInteraction, app: App): Promise<void> {
  const expr = interaction.options.getString('expression', true);
  const result = safeEval(expr);
  await v2Reply(interaction, `\`${expr}\` = **${result}**`, { ephemeral: true });
}

async function prefixExecute(message: Message, args: string[], app: App): Promise<void> {
  const expr = args.join(' ');
  if (!expr) {
    await message.reply({ content: 'Usage: `!calc <expression>`' });
    return;
  }
  await message.reply({ content: `\`${expr}\` = **${safeEval(expr)}**` });
}

function safeEval(expr: string): string {
  const sanitized = expr.replace(/[^0-9+\-*/().% ]/g, '');
  if (!sanitized) return 'invalid expression';
  try {
    const value = Function(`"use strict"; return (${sanitized});`)();
    if (typeof value !== 'number' || !Number.isFinite(value)) return 'invalid result';
    return String(Math.round(value * 1e6) / 1e6);
  } catch {
    return 'invalid expression';
  }
}

const command: BotCommand = {
  name: 'calculator',
  category: 'utility',
  description: 'Evaluate a math expression',
  data,
  permissions: [],
  aliases: ['calc'],
  execute,
  prefixExecute,
};

export default command;