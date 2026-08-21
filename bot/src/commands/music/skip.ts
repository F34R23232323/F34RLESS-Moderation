import { SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction, Message } from 'discord.js';
import type { App } from '../../core/context';
import type { BotCommand } from '../../types/command';
import { v2Reply, v2MessageReply } from '../../utils/v2';
import { getQueue, isUserInBotChannel } from '../../music/helpers';

const data = new SlashCommandBuilder()
  .setName('skip')
  .setDescription('Skip the current song (or several)')
  .addIntegerOption((o) =>
    o.setName('amount').setDescription('Number of songs to skip').setMinValue(1).setMaxValue(50).setRequired(false),
  );

async function run(app: App, guildId: string, member: any, amount: number): Promise<string | null> {
  const queue = getQueue(app, guildId);
  if (!queue) return 'Nothing is playing right now.';
  if (!isUserInBotChannel(app, guildId, member)) return 'You must be in the same voice channel as the bot.';
  const count = amount > 0 ? amount : 1;
  if (queue.songs.length <= 1 && !queue.autoplay) return 'There is no next song to skip to.';
  const skipped = queue.songs.slice(0, Math.min(count, queue.songs.length));
  await queue.jump(Math.min(count, queue.songs.length));
  const label = skipped.length > 1 ? `Skipped **${skipped.length}** songs.` : `Skipped **${skipped[0]?.name ?? 'song'}**.`;
  await app.music.refreshPanel(guildId, getQueue(app, guildId));
  return label;
}

async function execute(interaction: ChatInputCommandInteraction, app: App): Promise<void> {
  const guild = interaction.guild;
  if (!guild) return;
  const amount = interaction.options.getInteger('amount') ?? 1;
  const error = await run(app, guild.id, interaction.member, amount);
  await v2Reply(interaction, error ?? '⏭ Skipped.', { ephemeral: !!error });
}

async function prefixExecute(message: Message, args: string[], app: App): Promise<void> {
  const guild = message.guild;
  if (!guild) return;
  const amount = Math.max(1, parseInt(args[0] ?? '1', 10) || 1);
  const error = await run(app, guild.id, message.member, amount);
  await v2MessageReply(message, { content: error ?? '⏭ Skipped.' });
}

const command: BotCommand = {
  name: 'skip',
  category: 'music',
  description: 'Skip the current song',
  data,
  permissions: [],
  aliases: ['s', 'next'],
  execute,
  prefixExecute,
};

export default command;