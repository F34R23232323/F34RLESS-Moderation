import { SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction, Message } from 'discord.js';
import type { App } from '../../core/context';
import type { BotCommand } from '../../types/command';
import { v2Reply } from '../../utils/v2';

const data = new SlashCommandBuilder()
  .setName('color')
  .setDescription('Preview a color and get its hex (role-color helper)')
  .addStringOption((o) => o.setName('hex').setDescription('Hex code, e.g. #5865F2').setRequired(true));

async function execute(interaction: ChatInputCommandInteraction, app: App): Promise<void> {
  const input = interaction.options.getString('hex', true).replace('#', '').trim();
  if (!/^[0-9a-fA-F]{6}$/.test(input)) {
    await v2Reply(interaction, 'Invalid hex color. Use format #RRGGBB.', { ephemeral: true });
    return;
  }
  const r = parseInt(input.slice(0, 2), 16);
  const g = parseInt(input.slice(2, 4), 16);
  const b = parseInt(input.slice(4, 6), 16);
  const swatch = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" fill="#${input}"/></svg>`,
  );
  await interaction.reply({
    content: `#${input.toUpperCase()} — RGB(${r}, ${g}, ${b}) — use this on a role with \`/rolecolor <#${input}>\``,
    files: [{ attachment: swatch, name: 'color.svg' }],
  });
}

async function prefixExecute(message: Message, args: string[], app: App): Promise<void> {
  const input = (args[0] ?? '').replace('#', '').trim();
  if (!/^[0-9a-fA-F]{6}$/.test(input)) {
    await message.reply({ content: 'Usage: `!color <#RRGGBB>`' });
    return;
  }
  await message.reply({ content: `#${input.toUpperCase()}` });
}

const command: BotCommand = {
  name: 'color',
  category: 'utility',
  description: 'Preview a color and get its hex (role-color helper)',
  data,
  permissions: [],
  aliases: ['colour'],
  execute,
  prefixExecute,
};

export default command;