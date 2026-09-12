import type { ButtonInteraction } from 'discord.js';
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ContainerBuilder,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
  MessageFlags,
  SeparatorBuilder,
  TextDisplayBuilder,
} from 'discord.js';
import type { App } from '../core/context';
import {
  SOCIAL_ACTIONS,
  buildSocialResponse,
  blockUser,
  isBlocked,
  isDisabled,
  setDisabled,
  fetchSocialGif,
  type SocialAction,
} from '../utils/social';

function findAction(name: string): SocialAction | undefined {
  return SOCIAL_ACTIONS.find((a) => a.name === name);
}

function v2Update(text: string) {
  const container = new ContainerBuilder().addTextDisplayComponents(new TextDisplayBuilder().setContent(text));
  return { components: [container], flags: MessageFlags.IsComponentsV2 };
}

const socialBackButton = {
  type: 'button' as const,
  id: 'social:back:',
  async run(app: App, interaction: ButtonInteraction): Promise<void> {
    const parts = interaction.customId.split(':');
    if (parts.length < 5) {
      await interaction.update(v2Update('Invalid action.') as never);
      return;
    }

    const actionName = parts[2];
    const originalActorId = parts[3];
    const originalTargetId = parts[4];
    const currentUserId = interaction.user.id;

    const action = findAction(actionName);
    if (!action) {
      await interaction.update(v2Update('Unknown action.') as never);
      return;
    }

    await interaction.deferUpdate();

    if (await isDisabled(app.db, originalActorId)) {
      await interaction.editReply(v2Update('That user has disabled social commands.') as never);
      return;
    }

    if (await isBlocked(app.db, originalActorId, currentUserId)) {
      await interaction.editReply(v2Update('You are blocked from using social commands on that user.') as never);
      return;
    }

    const gifUrl = await fetchSocialGif(action.apiPath);
    if (!gifUrl) {
      await interaction.editReply(v2Update('Failed to fetch GIF. Try again later.') as never);
      return;
    }

    let actorTag: string;
    let targetTag: string;
    try {
      const actorUser = await app.client.users.fetch(currentUserId);
      actorTag = actorUser.username;
    } catch {
      actorTag = 'Unknown User';
    }
    try {
      const targetUser = await app.client.users.fetch(originalActorId);
      targetTag = targetUser.username;
    } catch {
      targetTag = 'Unknown User';
    }

    const payload = buildSocialResponse(action, actorTag, currentUserId, targetTag, originalActorId, gifUrl, true);
    await interaction.editReply(payload as never);
  },
};

const socialBlockButton = {
  type: 'button' as const,
  id: 'social:block:',
  async run(app: App, interaction: ButtonInteraction): Promise<void> {
    const parts = interaction.customId.split(':');
    if (parts.length < 4) {
      await interaction.update(v2Update('Invalid action.') as never);
      return;
    }

    const blockerId = parts[2];
    const blockedId = parts[3];

    if (interaction.user.id !== blockerId) {
      await interaction.reply({ content: 'Only the targeted user can block someone.', ephemeral: true });
      return;
    }

    if (await isBlocked(app.db, blockerId, blockedId)) {
      await interaction.reply({ content: 'This user is already blocked.', ephemeral: true });
      return;
    }

    await blockUser(app.db, blockerId, blockedId);

    let blockedTag: string;
    try {
      const user = await app.client.users.fetch(blockedId);
      blockedTag = user.username;
    } catch {
      blockedTag = 'Unknown User';
    }

    await interaction.reply({
      content: `You have blocked **${blockedTag}** from using social commands on you.`,
      flags: MessageFlags.Ephemeral,
    });
  },
};

const socialDisableButton = {
  type: 'button' as const,
  id: 'social:disable:',
  async run(app: App, interaction: ButtonInteraction): Promise<void> {
    const parts = interaction.customId.split(':');
    if (parts.length < 3) {
      await interaction.update(v2Update('Invalid action.') as never);
      return;
    }

    const userId = parts[2];

    if (interaction.user.id !== userId) {
      await interaction.reply({ content: 'Only you can disable social commands for yourself.', ephemeral: true });
      return;
    }

    const alreadyDisabled = await isDisabled(app.db, userId);

    if (alreadyDisabled) {
      await setDisabled(app.db, userId, false);
      await interaction.reply({
        content: 'Social commands targeting you have been **enabled**.',
        flags: MessageFlags.Ephemeral,
      });
    } else {
      await setDisabled(app.db, userId, true);
      await interaction.reply({
        content: 'Social commands targeting you have been **disabled**. Click again to re-enable.',
        flags: MessageFlags.Ephemeral,
      });
    }
  },
};

export default [socialBackButton, socialBlockButton, socialDisableButton];
