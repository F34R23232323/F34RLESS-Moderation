import { SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction, Message } from 'discord.js';
import type { App } from '../../core/context';
import type { BotCommand } from '../../types/command';
import { v2MessageReply, v2Reply } from '../../utils/v2';
import * as QRCode from 'qrcode';

const data = new SlashCommandBuilder()
  .setName('qrcode')
  .setDescription('Generate a QR code from text or URL')
  .addStringOption((o) => o.setName('text').setDescription('Text or URL').setRequired(true));

async function execute(interaction: ChatInputCommandInteraction, app: App): Promise<void> {
  await interaction.deferReply();
  const text = interaction.options.getString('text', true);
  const buffer = await QRCode.toBuffer(text, { width: 512, margin: 2 });
  await interaction.editReply({
    content: `QR for: ${text.slice(0, 200)}`,
    files: [{ attachment: buffer, name: 'qrcode.png' }],
  });
}

async function prefixExecute(message: Message, args: string[], app: App): Promise<void> {
  const text = args.join(' ');
  if (!text) {
    await v2MessageReply(message, { content: 'Usage: `!qrcode <text>`' });
    return;
  }
  const buffer = await QRCode.toBuffer(text, { width: 512, margin: 2 });
  await message.reply({
    content: `QR for: ${text.slice(0, 200)}`,
    files: [{ attachment: buffer, name: 'qrcode.png' }],
    allowedMentions: { parse: [], repliedUser: false },
  });
}

const command: BotCommand = {
  name: 'qrcode',
  category: 'utility',
  description: 'Generate a QR code from text or URL',
  usage: '!qrcode <text>',
  data,
  permissions: [],
  aliases: ['qr'],
  execute,
  prefixExecute,
};

export default command;