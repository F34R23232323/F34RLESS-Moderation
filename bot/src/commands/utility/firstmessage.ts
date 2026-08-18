import { SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction, Message } from 'discord.js';
import type { App } from '../../core/context';
import type { BotCommand } from '../../types/command';
import { v2Reply } from '../../utils/v2';

const data = new SlashCommandBuilder()
  .setName('firstmessage')
  .setDescription('Jump-link to a channel\'s first message');

async function execute(interaction: ChatInputCommandInteraction, app: App): Promise<void> {
  await interaction.deferReply({ ephemeral: true });
  const channel = interaction.channel as { messages?: { fetch: (opts: { limit: number; before?: string }) => Promise<unknown> } };
  if (!channel?.messages) {
    await v2Reply(interaction, 'Not available in this channel.', { ephemeral: true });
    return;
  }
  const messages = (await channel.messages.fetch({ limit: 1 })) as { last: () => { id: string } | undefined; size: number };
  const first = messages.last();
  if (!first) {
    await v2Reply(interaction, 'No messages found.', { ephemeral: true });
    return;
  }
  await v2Reply(interaction, `First message: https://discord.com/channels/${interaction.guildId}/${interaction.channelId}/${first.id}`);
}

const command: BotCommand = {
  name: 'firstmessage',
  category: 'utility',
  description: 'Jump-link to a channel\'s first message',
  data,
  permissions: [],
  aliases: ['first'],
  execute,
};

export default command;