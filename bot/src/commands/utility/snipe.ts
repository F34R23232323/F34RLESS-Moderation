import { SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction, Message } from 'discord.js';
import type { App } from '../../core/context';
import type { BotCommand } from '../../types/command';
import { v2Reply } from '../../utils/v2';
import { getDeleted, getEdited } from '../../utils/snipe';
import { v2MessageReply } from '../../utils/v2';

function snipeCommand(name: string, description: string, kind: 'deleted' | 'edited'): BotCommand {
  const data = new SlashCommandBuilder().setName(name).setDescription(description);
  return {
    name,
    category: 'utility',
    description,
    data,
    permissions: ['ManageMessages'],
    aliases: [],
    async execute(interaction, app) {
      await interaction.deferReply({ ephemeral: true });
      const retentionMs = app.config.ops.snipe_retention_seconds * 1000;
      const entry = kind === 'deleted' ? getDeleted(interaction.channelId, retentionMs) : getEdited(interaction.channelId, retentionMs);
      if (!entry) {
        await v2Reply(interaction, 'Nothing to snipe here.', { ephemeral: true });
        return;
      }
      await v2Reply(interaction, `**${entry.authorName}**\n${entry.content.slice(0, 1500)}`);
    },
    async prefixExecute(message, _args, app) {
      const retentionMs = app.config.ops.snipe_retention_seconds * 1000;
      const entry = kind === 'deleted' ? getDeleted(message.channelId, retentionMs) : getEdited(message.channelId, retentionMs);
      if (!entry) {
        await v2MessageReply(message, { content: 'Nothing to snipe here.' });
        return;
      }
      await v2MessageReply(message, { content: `**${entry.authorName}**\n${entry.content.slice(0, 1500)}` });
    },
  };
}

export default [snipeCommand('snipe', 'Recall the last deleted message', 'deleted'), snipeCommand('editsnipe', 'Recall the last edited message', 'edited')];