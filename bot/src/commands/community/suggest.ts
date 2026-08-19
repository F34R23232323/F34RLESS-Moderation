import { SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction, Message } from 'discord.js';
import type { App } from '../../core/context';
import type { BotCommand } from '../../types/command';
import { v2Reply } from '../../utils/v2';
import { v2MessageReply } from '../../utils/v2';

function buildSuggestionPayload(userId: string, suggestion: string, id: string) {
  return {
    content: `**Suggestion from <@${userId}>**\n${suggestion}`,
    components: [
      {
        type: 1,
        components: [
          { type: 2, custom_id: `suggest:up:${id}`, label: 'Upvote', style: 3 },
          { type: 2, custom_id: `suggest:down:${id}`, label: 'Downvote', style: 4 },
        ],
      },
    ],
  };
}

async function postSuggestion(app: App, guildId: string, userId: string, suggestion: string, id: string): Promise<void> {
  const cfg = app.config.community.suggestions;
  const guild = app.client.guilds.cache.get(guildId);
  if (!guild) return;
  const channel = guild.channels.cache.get(cfg.channel_id!);
  if (!channel || !('send' in channel)) return;
  const sent = await (channel as any).send(buildSuggestionPayload(userId, suggestion, id));
  await app.db.execute('INSERT INTO suggestions (guild_id, message_id, user_id, content) VALUES (?, ?, ?, ?)', [
    guild.id,
    sent.id,
    userId,
    suggestion,
  ]);
}

const data = new SlashCommandBuilder()
  .setName('suggest')
  .setDescription('Submit a suggestion to the community')
  .addStringOption((o) => o.setName('suggestion').setDescription('Your suggestion').setRequired(true));

async function execute(interaction: ChatInputCommandInteraction, app: App): Promise<void> {
  const cfg = app.config.community.suggestions;
  const guild = interaction.guild;
  if (!cfg.enabled || !cfg.channel_id || !guild) {
    await v2Reply(interaction, 'Suggestions are not enabled.', { ephemeral: true });
    return;
  }
  const channel = guild.channels.cache.get(cfg.channel_id);
  if (!channel || !('send' in channel)) {
    await v2Reply(interaction, 'Suggestion channel is misconfigured.', { ephemeral: true });
    return;
  }
  await interaction.deferReply({ ephemeral: true });
  const suggestion = interaction.options.getString('suggestion', true);
  await postSuggestion(app, guild.id, interaction.user.id, suggestion, interaction.id);
  await v2Reply(interaction, 'Suggestion posted.', { ephemeral: true });
}

async function prefixExecute(message: Message, args: string[], app: App): Promise<void> {
  const cfg = app.config.community.suggestions;
  const guild = message.guild;
  const suggestion = args.join(' ');
  if (!cfg.enabled || !cfg.channel_id || !guild || !suggestion) {
    await v2MessageReply(message, { content: 'Suggestions are not enabled.' });
    return;
  }
  const channel = guild.channels.cache.get(cfg.channel_id);
  if (!channel || !('send' in channel)) {
    await v2MessageReply(message, { content: 'Suggestion channel is misconfigured.' });
    return;
  }
  await postSuggestion(app, guild.id, message.author.id, suggestion, message.id);
  await v2MessageReply(message, { content: 'Suggestion posted.' });
}

const command: BotCommand = {
  name: 'suggest',
  category: 'community',
  description: 'Submit a suggestion to the community',
  data,
  permissions: [],
  aliases: [],
  execute,
  prefixExecute,
};

export default command;