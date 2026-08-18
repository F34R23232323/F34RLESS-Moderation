import { SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction, Message } from 'discord.js';
import type { App } from '../../core/context';
import type { BotCommand } from '../../types/command';
import { v2Reply } from '../../utils/v2';
import * as crypto from 'crypto';

const data = new SlashCommandBuilder()
  .setName('hash')
  .setDescription('Hash a string (md5, sha1, sha256)')
  .addStringOption((o) => o.setName('algorithm').setDescription('Algorithm').addChoices({ name: 'md5', value: 'md5' }, { name: 'sha1', value: 'sha1' }, { name: 'sha256', value: 'sha256' }).setRequired(true))
  .addStringOption((o) => o.setName('text').setDescription('Text').setRequired(true));

async function execute(interaction: ChatInputCommandInteraction, app: App): Promise<void> {
  const algorithm = interaction.options.getString('algorithm', true) as 'md5' | 'sha1' | 'sha256';
  const text = interaction.options.getString('text', true);
  const result = crypto.createHash(algorithm).update(text).digest('hex');
  await v2Reply(interaction, `\`${algorithm}\`\n\`\`\`\n${result}\n\`\`\``, { ephemeral: true });
}

async function prefixExecute(message: Message, args: string[], app: App): Promise<void> {
  const algorithm = args[0] ?? 'sha256';
  const text = args.slice(1).join(' ');
  if (!text) {
    await message.reply({ content: 'Usage: `!hash <md5|sha1|sha256> <text>`' });
    return;
  }
  const result = crypto.createHash(algorithm as 'md5' | 'sha1' | 'sha256').update(text).digest('hex');
  await message.reply({ content: `\`${algorithm}\`: \`${result}\`` });
}

const command: BotCommand = {
  name: 'hash',
  category: 'utility',
  description: 'Hash a string (md5, sha1, sha256)',
  data,
  permissions: [],
  aliases: [],
  execute,
  prefixExecute,
};

export default command;