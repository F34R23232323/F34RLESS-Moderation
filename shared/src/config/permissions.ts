import { z } from 'zod';

export const PERMISSION_NAMES = [
  'CreateInstantInvite', 'KickMembers', 'BanMembers', 'Administrator', 'ManageChannels',
  'ManageGuild', 'AddReactions', 'ViewAuditLog', 'PrioritySpeaker', 'Stream',
  'ViewChannel', 'SendMessages', 'SendTTSMessages', 'ManageMessages', 'EmbedLinks',
  'AttachFiles', 'ReadMessageHistory', 'MentionEveryone', 'UseExternalEmojis',
  'ViewGuildInsights', 'Connect', 'Speak', 'MuteMembers', 'DeafenMembers',
  'MoveMembers', 'UseVAD', 'ChangeNickname', 'ManageNicknames', 'ManageRoles',
  'ManageWebhooks', 'ManageGuildExpressions', 'UseApplicationCommands', 'RequestToSpeak',
  'ManageEvents', 'ManageThreads', 'CreatePublicThreads', 'CreatePrivateThreads',
  'UseExternalStickers', 'SendMessagesInThreads', 'UseEmbeddedActivities',
  'ModerateMembers', 'ViewCreatorMonetizationAnalytics', 'UseSoundboard',
  'CreateGuildExpressions', 'CreateEvents', 'UseExternalSounds', 'SendVoiceMessages',
  'SendPolls', 'UseExternalApps', 'SendMessagesInPolls',
] as const;

export type PermissionName = (typeof PERMISSION_NAMES)[number];

export const permissionNamesSchema = z
  .array(z.enum(PERMISSION_NAMES))
  .default([]);