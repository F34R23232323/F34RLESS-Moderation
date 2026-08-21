import { SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction, Message } from 'discord.js';
import type { App } from '../../core/context';
import type { BotCommand } from '../../types/command';
import { v2Reply, v2MessageReply } from '../../utils/v2';
import { getQueue, isUserInBotChannel } from '../../music/helpers';

const data = new SlashCommandBuilder()
  .setName('volume')
  .setDescription('Set the music volume (or show current)')
  .addIntegerOption((o) => o.setName('level').setDescription('Volume 0-200').setMinValue(0).setMaxValue(500).setRequired(false));

async function run(app: App, guildId: string, member: any, level: number | null): Promise<string | null> {
  const queue = getQueue(app, guildId);
  if (level !== null) {
    if (!queue) return 'Nothing is playing right now.';
    if (!isUserInBotChannel(app, guildId, member)) return 'You must be in the same voice channel as the bot.';
    const clamped = await app.music.setVolume(guildId, level);
    return `🔊 Volume set to **${clamped}%**.`;
  }
  const settings = await app.music.getSettings(guildId);
  return `🔊 Current volume: **${queue?.volume ?? settings.volume}%**.`;
}

async function execute(interaction: ChatInputCommandInteraction, app: App): Promise<void> {
  const guild = interaction.guild;
  if (!guild) return;
  const level = interaction.options.getInteger('level');
  const error = await run(app, guild.id, interaction.member, level);
  await v2Reply(interaction, error ?? '', { ephemeral: !!error });
}

async function prefixExecute(message: Message, args: string[], app: App): Promise<void> {
  const guild = message.guild;
  if (!guild) return;
  const level = args[0] !== undefined ? (parseInt(args[0], 10) || null) : null;
  const error = await run(app, guild.id, message.member, level);
  await v2MessageReply(message, { content: error ?? '' });
}

const command: BotCommand = {
  name: 'volume',
  category: 'music',
  description: 'Set the music volume',
  data,
  permissions: [],
  aliases: ['vol'],
  execute,
  prefixExecute,
};

export default command;