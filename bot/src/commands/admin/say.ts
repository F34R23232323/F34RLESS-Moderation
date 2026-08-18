import { SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction, Message } from 'discord.js';
import type { App } from '../../core/context';
import type { BotCommand } from '../../types/command';
import { v2Reply } from '../../utils/v2';

function sayCommand(name: string, description: string, staff: boolean): BotCommand {
  const data = new SlashCommandBuilder()
    .setName(name)
    .setDescription(description)
    .addStringOption((o) => o.setName('message').setDescription('Message text').setRequired(true))
    .addChannelOption((o) => o.setName('channel').setDescription('Target channel (default: current)').setRequired(false));
  return {
    name,
    category: 'admin',
    description,
    data,
    permissions: staff ? ['ManageMessages'] : [],
    aliases: [],
    async execute(interaction, app) {
      await interaction.deferReply({ ephemeral: true });
      const text = interaction.options.getString('message', true);
      const channelOpt = interaction.options.getChannel('channel');
      const target: any = channelOpt ?? interaction.channel;
      if (!target || !('send' in target)) {
        await v2Reply(interaction, 'Invalid target channel.', { ephemeral: true });
        return;
      }
      await target.send({ content: text });
      await v2Reply(interaction, 'Sent.', { ephemeral: true });
    },
    async prefixExecute(message, args, app) {
      const text = args.join(' ');
      if (!text) {
        await message.reply({ content: `Usage: !${name} <text>` });
        return;
      }
      await message.delete().catch(() => undefined);
      await (message.channel as any).send({ content: text });
    },
  };
}

export default [sayCommand('say', 'Send a message as the bot', false), sayCommand('announce', 'Send an announcement as the bot', true)];