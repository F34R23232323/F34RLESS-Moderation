import { SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction, Message } from 'discord.js';
import type { App } from '../../core/context';
import type { BotCommand } from '../../types/command';
import { v2Reply } from '../../utils/v2';
import { resolveMemberOption } from '../../utils/discord';
import { v2MessageReply } from '../../utils/v2';

function voiceCommand(name: string, description: string, aliases: string[], action: (m: any) => Promise<void>): BotCommand {
  const data = new SlashCommandBuilder()
    .setName(name)
    .setDescription(description)
    .addUserOption((o) => o.setName('user').setDescription('Target user').setRequired(true));
  return {
    name,
    category: 'moderation',
    description,
    data,
    permissions: ['MuteMembers'],
    aliases,
    async execute(interaction, app) {
      await interaction.deferReply();
      const guild = interaction.guild;
      if (!guild) return;
      const resolved = await resolveMemberOption(interaction, guild, app);
      if (!resolved?.member) {
        await v2Reply(interaction, 'User not found.', { ephemeral: true });
        return;
      }
      try {
        await action(resolved.member);
        await v2Reply(interaction, `Done for <@${resolved.user!.id}>.`);
      } catch (err) {
        await v2Reply(interaction, `Failed: ${(err as Error).message}`, { ephemeral: true });
      }
    },
    async prefixExecute(message, args, app) {
      const guild = message.guild;
      const targetId = args[0]?.replace(/[<@!>]/g, '');
      if (!guild || !targetId) {
        await v2MessageReply(message, { content: `Usage: !${name} <user>` });
        return;
      }
      const member = await guild.members.fetch(targetId).catch(() => null);
      if (!member) {
        await v2MessageReply(message, { content: 'User not found.' });
        return;
      }
      await action(member).then(() => v2MessageReply(message, { content: `Done for <@${targetId}>.` })).catch((err) => v2MessageReply(message, { content: `Failed: ${err.message}` }));
    },
  };
}

export default [
  voiceCommand('voicemute', 'Server-mute a user in voice', ['vmute'], (m) => m.voice.setMute(true, 'Voice moderation')),
  voiceCommand('voiceunmute', 'Server-unmute a user in voice', ['vunmute'], (m) => m.voice.setMute(false, 'Voice moderation')),
  voiceCommand('voicedeafen', 'Server-deafen a user in voice', ['vdeafen'], (m) => m.voice.setDeaf(true, 'Voice moderation')),
  voiceCommand('voiceundeafen', 'Server-undeafen a user in voice', ['vundeafen'], (m) => m.voice.setDeaf(false, 'Voice moderation')),
  voiceCommand('vkick', 'Force-disconnect a user from voice', ['voicekick', 'disconnect'], (m) => m.voice.disconnect('Voice moderation')),
];