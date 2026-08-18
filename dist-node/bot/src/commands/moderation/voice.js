"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const v2_1 = require("../../utils/v2");
const discord_1 = require("../../utils/discord");
function voiceCommand(name, description, aliases, action) {
    const data = new discord_js_1.SlashCommandBuilder()
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
            if (!guild)
                return;
            const resolved = await (0, discord_1.resolveMemberOption)(interaction, guild, app);
            if (!resolved?.member) {
                await (0, v2_1.v2Reply)(interaction, 'User not found.', { ephemeral: true });
                return;
            }
            try {
                await action(resolved.member);
                await (0, v2_1.v2Reply)(interaction, `Done for <@${resolved.user.id}>.`);
            }
            catch (err) {
                await (0, v2_1.v2Reply)(interaction, `Failed: ${err.message}`, { ephemeral: true });
            }
        },
        async prefixExecute(message, args, app) {
            const guild = message.guild;
            const targetId = args[0]?.replace(/[<@!>]/g, '');
            if (!guild || !targetId) {
                await message.reply({ content: `Usage: !${name} <user>` });
                return;
            }
            const member = await guild.members.fetch(targetId).catch(() => null);
            if (!member) {
                await message.reply({ content: 'User not found.' });
                return;
            }
            await action(member).then(() => message.reply({ content: `Done for <@${targetId}>.` })).catch((err) => message.reply({ content: `Failed: ${err.message}` }));
        },
    };
}
exports.default = [
    voiceCommand('voicemute', 'Server-mute a user in voice', ['vmute'], (m) => m.voice.setMute(true, 'Voice moderation')),
    voiceCommand('voiceunmute', 'Server-unmute a user in voice', ['vunmute'], (m) => m.voice.setMute(false, 'Voice moderation')),
    voiceCommand('voicedeafen', 'Server-deafen a user in voice', ['vdeafen'], (m) => m.voice.setDeaf(true, 'Voice moderation')),
    voiceCommand('voiceundeafen', 'Server-undeafen a user in voice', ['vundeafen'], (m) => m.voice.setDeaf(false, 'Voice moderation')),
    voiceCommand('vkick', 'Force-disconnect a user from voice', ['voicekick', 'disconnect'], (m) => m.voice.disconnect('Voice moderation')),
];
//# sourceMappingURL=voice.js.map