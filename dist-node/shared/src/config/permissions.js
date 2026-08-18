"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.permissionNamesSchema = exports.PERMISSION_NAMES = void 0;
const zod_1 = require("zod");
exports.PERMISSION_NAMES = [
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
];
exports.permissionNamesSchema = zod_1.z
    .array(zod_1.z.enum(exports.PERMISSION_NAMES))
    .default([]);
//# sourceMappingURL=permissions.js.map