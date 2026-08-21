import { SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction, Message } from 'discord.js';
import type { App } from '../../core/context';
import type { BotCommand } from '../../types/command';
import { v2Reply, v2MessageReply } from '../../utils/v2';
import { getQueue, isUserInBotChannel } from '../../music/helpers';

const data = new SlashCommandBuilder().setName('pause').setDescription('Pause the current song');

async function execute(interaction: ChatInputCommandInteraction, app: App): Promise<void> {
  const guild = interaction.guild;
  if (!guild) return;
  const queue = getQueue(app, guild.id);
  if (!queue) {
    await v2Reply(interaction, 'Nothing is playing right now.', { ephemeral: true });
    return;
  }
  if (!isUserInBotChannel(app, guild.id, interaction.member as any)) {
    await v2Reply(interaction, 'You must be in the same voice channel as the bot.', { ephemeral: true });
    return;
  }
  if (queue.paused) {
    await v2Reply(interaction, 'Already paused.', { ephemeral: true });
    return;
  }
  await queue.pause();
  await app.music.refreshPanel(guild.id, queue);
  await v2Reply(interaction, '⏸ Paused.');
}

async function prefixExecute(message: Message, _args: string[], app: App): Promise<void> {
  const guild = message.guild;
  if (!guild) return;
  const queue = getQueue(app, guild.id);
  if (!queue) {
    await v2MessageReply(message, { content: 'Nothing is playing right now.' });
    return;
  }
  if (!isUserInBotChannel(app, guild.id, message.member)) {
    await v2MessageReply(message, { content: 'You must be in the same voice channel as the bot.' });
    return;
  }
  if (queue.paused) {
    await v2MessageReply(message, { content: 'Already paused.' });
    return;
  }
  await queue.pause();
  await app.music.refreshPanel(guild.id, queue);
  await v2MessageReply(message, { content: '⏸ Paused.' });
}

const command: BotCommand = {
  name: 'pause',
  category: 'music',
  description: 'Pause the current song',
  data,
  permissions: [],
  aliases: [],
  execute,
  prefixExecute,
};

export default command;