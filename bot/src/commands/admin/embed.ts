import { SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction, Message } from 'discord.js';
import type { App } from '../../core/context';
import type { BotCommand } from '../../types/command';
import { v2Reply } from '../../utils/v2';

const data = new SlashCommandBuilder()
  .setName('embed')
  .setDescription('Craft an announcement message (staff)')
  .addStringOption((o) => o.setName('description').setDescription('Body text').setRequired(true))
  .addStringOption((o) => o.setName('title').setDescription('Title').setRequired(false))
  .addChannelOption((o) => o.setName('channel').setDescription('Target channel').setRequired(false))
  .addStringOption((o) => o.setName('accent').setDescription('Accent color hex').setRequired(false));

async function execute(interaction: ChatInputCommandInteraction, app: App): Promise<void> {
  await interaction.deferReply({ ephemeral: true });
  const title = interaction.options.getString('title');
  const description = interaction.options.getString('description', true);
  const accent = interaction.options.getString('accent') ?? undefined;
  const channelOpt = interaction.options.getChannel('channel');
  const target: any = channelOpt ?? interaction.channel;
  if (!target?.send) {
    await v2Reply(interaction, 'Invalid target channel.', { ephemeral: true });
    return;
  }
  const content = title ? `**${title}**\n${description}` : description;
  const { v2Send } = await import('../../utils/v2');
  await v2Send(target, content, { accentColor: accent?.startsWith('#') ? accent : accent ? `#${accent}` : undefined });
  await v2Reply(interaction, 'Sent.', { ephemeral: true });
}

async function prefixExecute(message: Message, args: string[], app: App): Promise<void> {
  const text = args.join(' ');
  if (!text) {
    await message.reply({ content: 'Usage: `!embed <title | body>`' });
    return;
  }
  const parts = text.split(' | ');
  const content = parts.length > 1 ? `**${parts[0]}**\n${parts.slice(1).join(' | ')}` : text;
  await message.delete().catch(() => undefined);
  await (message.channel as any).send({ content });
}

const command: BotCommand = {
  name: 'embed',
  category: 'admin',
  description: 'Craft an announcement message (staff)',
  data,
  permissions: ['ManageMessages'],
  aliases: ['embedbuilder'],
  execute,
  prefixExecute,
};

export default command;