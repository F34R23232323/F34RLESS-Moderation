import { SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction, Message } from 'discord.js';
import { RepeatMode } from 'distube';
import type { App } from '../../core/context';
import type { BotCommand } from '../../types/command';
import { v2Reply, v2MessageReply } from '../../utils/v2';
import { getQueue, isUserInBotChannel } from '../../music/helpers';

const MODES = ['off', 'song', 'queue'] as const;

const data = new SlashCommandBuilder()
  .setName('loop')
  .setDescription('Set loop mode (or toggle)')
  .addStringOption((o) =>
    o
      .setName('mode')
      .setDescription('Loop mode')
      .setRequired(false)
      .addChoices(
        { name: 'Off', value: 'off' },
        { name: 'Song', value: 'song' },
        { name: 'Queue', value: 'queue' },
      ),
  );

async function run(app: App, guildId: string, member: any, mode: string | null): Promise<string | null> {
  const queue = getQueue(app, guildId);
  if (!queue) return 'Nothing is playing right now.';
  if (!isUserInBotChannel(app, guildId, member)) return 'You must be in the same voice channel as the bot.';
  let next: RepeatMode;
  if (mode === null) {
    next = queue.setRepeatMode() as RepeatMode;
  } else {
    next = (queue.setRepeatMode(MODES.indexOf(mode as (typeof MODES)[number])) as RepeatMode) ?? 0;
  }
  await app.music.refreshPanel(guildId, queue);
  return `🔁 Loop: **${['Off', 'Song', 'Queue'][next] ?? 'Off'}**.`;
}

async function execute(interaction: ChatInputCommandInteraction, app: App): Promise<void> {
  const guild = interaction.guild;
  if (!guild) return;
  const mode = interaction.options.getString('mode');
  const error = await run(app, guild.id, interaction.member, mode);
  await v2Reply(interaction, error ?? '🔁 Loop updated.', { ephemeral: !!error });
}

async function prefixExecute(message: Message, args: string[], app: App): Promise<void> {
  const guild = message.guild;
  if (!guild) return;
  const raw = args[0]?.toLowerCase();
  const mode = raw && (MODES as readonly string[]).includes(raw) ? raw : null;
  const error = await run(app, guild.id, message.member, mode);
  await v2MessageReply(message, { content: error ?? '🔁 Loop updated.' });
}

const command: BotCommand = {
  name: 'loop',
  category: 'music',
  description: 'Set loop mode',
  data,
  permissions: [],
  aliases: ['repeat'],
  execute,
  prefixExecute,
};

export default command;