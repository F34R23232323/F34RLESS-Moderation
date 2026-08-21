import { SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction, Message } from 'discord.js';
import type { App } from '../../core/context';
import type { BotCommand } from '../../types/command';
import { v2Reply, v2MessageReply } from '../../utils/v2';
import { MUSIC_FILTERS, getMusicFilter } from '../../music/filters';
import { getQueue, isUserInBotChannel } from '../../music/helpers';

const data = new SlashCommandBuilder()
  .setName('filter')
  .setDescription('Set an audio filter (or show current)')
  .addStringOption((o) =>
    o
      .setName('name')
      .setDescription('Filter name or "off"')
      .setRequired(false)
      .addChoices(
        { name: 'Off', value: 'off' },
        ...MUSIC_FILTERS.map((f) => ({ name: f.label, value: f.key })),
      ),
  );

async function run(app: App, guildId: string, member: any, name: string | null): Promise<string | null> {
  const queue = getQueue(app, guildId);
  if (name === null) {
    if (!queue) return 'Nothing is playing right now.';
    const current = queue.filters.names;
    return `🎚️ Current filters: **${current.length ? current.map((n) => getMusicFilter(n)?.label ?? n).join(', ') : 'Off'}**.`;
  }
  if (!queue) return 'Nothing is playing right now.';
  if (!isUserInBotChannel(app, guildId, member)) return 'You must be in the same voice channel as the bot.';
  await app.music.setFilter(guildId, name);
  if (name === 'off') return '🎚️ Filters disabled.';
  const def = getMusicFilter(name);
  return `🎚️ Filter set: **${def ? `${def.emoji} ${def.label}` : name}**.`;
}

async function execute(interaction: ChatInputCommandInteraction, app: App): Promise<void> {
  const guild = interaction.guild;
  if (!guild) return;
  const name = interaction.options.getString('name');
  const error = await run(app, guild.id, interaction.member, name);
  await v2Reply(interaction, error ?? '', { ephemeral: !!error });
}

async function prefixExecute(message: Message, args: string[], app: App): Promise<void> {
  const guild = message.guild;
  if (!guild) return;
  const name = args[0] ? args[0].toLowerCase() : null;
  const error = await run(app, guild.id, message.member, name);
  await v2MessageReply(message, { content: error ?? '' });
}

const command: BotCommand = {
  name: 'filter',
  category: 'music',
  description: 'Set an audio filter',
  data,
  permissions: [],
  aliases: ['filters', 'fx'],
  execute,
  prefixExecute,
};

export default command;