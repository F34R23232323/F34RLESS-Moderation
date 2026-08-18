import { SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction, Message } from 'discord.js';
import type { App } from '../../core/context';
import type { BotCommand } from '../../types/command';
import { v2Reply } from '../../utils/v2';

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
  const suggestion = interaction.options.getString('suggestion', true);
  const channel = guild.channels.cache.get(cfg.channel_id);
  if (!channel || !('send' in channel)) {
    await v2Reply(interaction, 'Suggestion channel is misconfigured.', { ephemeral: true });
    return;
  }
  await interaction.deferReply({ ephemeral: true });
  const sent = await (channel as any).send({
    content: `**Suggestion from <@${interaction.user.id}>**\n${suggestion}`,
    components: [
      {
        type: 1,
        components: [
          { type: 2, custom_id: `suggest:up:${interaction.id}`, label: 'Upvote', style: 3 },
          { type: 2, custom_id: `suggest:down:${interaction.id}`, label: 'Downvote', style: 4 },
        ],
      },
    ],
  });
  await app.db.execute('INSERT INTO suggestions (guild_id, message_id, user_id, content) VALUES (?, ?, ?, ?)', [
    guild.id,
    sent.id,
    interaction.user.id,
    suggestion,
  ]);
  await v2Reply(interaction, 'Suggestion posted.', { ephemeral: true });
}

async function prefixExecute(message: Message, args: string[], app: App): Promise<void> {
  const cfg = app.config.community.suggestions;
  const guild = message.guild;
  const suggestion = args.join(' ');
  if (!cfg.enabled || !cfg.channel_id || !guild || !suggestion) {
    await message.reply({ content: 'Suggestions not enabled or missing text.' });
    return;
  }
  const channel = guild.channels.cache.get(cfg.channel_id);
  if (!channel || !('send' in channel)) return;
  await (channel as any).send({ content: `**Suggestion from <@${message.author.id}>**\n${suggestion}` });
  await message.reply({ content: 'Suggestion posted.' });
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