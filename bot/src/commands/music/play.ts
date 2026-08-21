import { SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction, GuildMember, Message } from 'discord.js';
import type { App } from '../../core/context';
import type { BotCommand } from '../../types/command';
import { v2Reply, v2MessageReply } from '../../utils/v2';
import { botCanJoin, getMemberVoiceChannel } from '../../music/helpers';

const data = new SlashCommandBuilder()
  .setName('play')
  .setDescription('Play a song or add it to the queue (YouTube, Spotify, SoundCloud, direct URLs)')
  .addStringOption((o) =>
    o
      .setName('query')
      .setDescription('Song name, YouTube/Spotify/SoundCloud link or direct audio URL')
      .setRequired(true),
  );

async function play(app: App, guildId: string, member: GuildMember | null, query: string, textChannel: any): Promise<string> {
  if (!app.config.music.enabled) return 'The music module is disabled in the bot config.';
  const voiceChannel = getMemberVoiceChannel(member);
  if (!voiceChannel) return 'You must be in a voice channel to play music.';
  if (!botCanJoin(voiceChannel, app)) {
    return 'I cannot join that voice channel — check my **Connect** / **Speak** permissions.';
  }
  try {
    const result = await app.music.play(guildId, voiceChannel, query, member!, textChannel);
    if (result.newQueue) {
      const name = result.name ?? query;
      const link = result.url ? `[${name}](${result.url})` : name;
      return `▶ Now playing **${link}**`;
    }
    if (result.count > 1) {
      return `➕ Added **${result.count} songs** to the queue.`;
    }
    const queue = app.music.distube.getQueue(guildId);
    const position = queue ? queue.songs.length : 1;
    const name = result.name ?? query;
    const link = result.url ? `[${name}](${result.url})` : name;
    return `➕ Added **${link}** to the queue (position ${position}).`;
  } catch (err) {
    return app.music.friendlyError(err as Error);
  }
}

async function execute(interaction: ChatInputCommandInteraction, app: App): Promise<void> {
  const guild = interaction.guild;
  if (!guild) return;
  await interaction.deferReply().catch(() => undefined);
  const member = interaction.member as GuildMember | null;
  const query = interaction.options.getString('query', true);
  const text = await play(app, guild.id, member, query, interaction.channel);
  await v2Reply(interaction, text);
}

async function prefixExecute(message: Message, args: string[], app: App): Promise<void> {
  const guild = message.guild;
  if (!guild) return;
  const query = args.join(' ').trim();
  if (!query) {
    await v2MessageReply(message, { content: 'Usage: `!play <song name or link>`' });
    return;
  }
  const text = await play(app, guild.id, message.member, query, message.channel);
  await v2MessageReply(message, { content: text });
}

const command: BotCommand = {
  name: 'play',
  category: 'music',
  description: 'Play a song or add it to the queue',
  data,
  permissions: [],
  aliases: ['p'],
  execute,
  prefixExecute,
};

export default command;