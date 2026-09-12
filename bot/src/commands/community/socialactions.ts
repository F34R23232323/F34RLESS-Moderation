import { SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction, Message } from 'discord.js';
import type { App } from '../../core/context';
import type { BotCommand } from '../../types/command';
import { v2MessageReply } from '../../utils/v2';
import {
  SOCIAL_ACTIONS,
  SOLO_ACTIONS,
  handleSocialCommand,
  handleSoloCommand,
  buildSocialResponse,
  buildSoloResponse,
  fetchSocialGif,
  isBlocked,
  isDisabled,
  type SocialAction,
  type SoloAction,
} from '../../utils/social';

function createCommand(action: SocialAction): BotCommand {
  const data = new SlashCommandBuilder()
    .setName(action.name)
    .setDescription(action.description)
    .addUserOption((o) => o.setName('user').setDescription('Target user').setRequired(true));

  async function execute(interaction: ChatInputCommandInteraction, app: App): Promise<void> {
    const targetId = interaction.options.getUser('user', true).id;
    await handleSocialCommand(interaction, app, action, targetId);
  }

  async function prefixExecute(message: Message, args: string[], app: App): Promise<void> {
    const mention = args[0];
    if (!mention) {
      await v2MessageReply(message, { content: `Usage: ?${action.name} @user` });
      return;
    }

    const targetId = mention.replace(/[<@!>]/g, '');
    if (!/^\d{15,20}$/.test(targetId)) {
      await v2MessageReply(message, { content: 'Invalid user. Mention someone or provide a user ID.' });
      return;
    }

    const userId = message.author.id;

    if (userId === targetId) {
      await v2MessageReply(message, { content: 'You can\'t use this on yourself!' });
      return;
    }

    if (await isDisabled(app.db, targetId)) {
      await v2MessageReply(message, { content: 'This user has disabled social commands.' });
      return;
    }

    if (await isBlocked(app.db, targetId, userId)) {
      await v2MessageReply(message, { content: 'This user has blocked you from using social commands on them.' });
      return;
    }

    const gifUrl = await fetchSocialGif(action.apiPath);
    if (!gifUrl) {
      await v2MessageReply(message, { content: 'Failed to fetch GIF. Try again later.' });
      return;
    }

    let targetTag: string;
    try {
      const targetUser = await app.client.users.fetch(targetId);
      targetTag = targetUser.username;
    } catch {
      targetTag = 'Unknown User';
    }

    const payload = buildSocialResponse(action, message.author.username, userId, targetTag, targetId, gifUrl);
    await message.reply({ ...payload, allowedMentions: { parse: [] } } as any);
  }

  return {
    name: action.name,
    category: 'social',
    description: action.description,
    data,
    permissions: [],
    aliases: [],
    execute,
    prefixExecute,
  };
}

const commands: BotCommand[] = SOCIAL_ACTIONS.map(createCommand);

function createSoloCommand(action: SoloAction): BotCommand {
  const data = new SlashCommandBuilder()
    .setName(action.name)
    .setDescription(action.description);

  async function execute(interaction: ChatInputCommandInteraction, app: App): Promise<void> {
    await handleSoloCommand(interaction, app, action);
  }

  async function prefixExecute(message: Message, _args: string[], app: App): Promise<void> {
    const userId = message.author.id;

    const gifUrl = await fetchSocialGif(action.apiPath);
    if (!gifUrl) {
      await v2MessageReply(message, { content: 'Failed to fetch GIF. Try again later.' });
      return;
    }

    const payload = buildSoloResponse(action, message.author.username, userId, gifUrl);
    await message.reply({ ...payload, allowedMentions: { parse: [] } } as any);
  }

  return {
    name: action.name,
    category: 'social',
    description: action.description,
    data,
    permissions: [],
    aliases: [],
    execute,
    prefixExecute,
  };
}

const soloCommands: BotCommand[] = SOLO_ACTIONS.map(createSoloCommand);

export default [...commands, ...soloCommands];
