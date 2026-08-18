"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const v2_1 = require("../../utils/v2");
const snipe_1 = require("../../utils/snipe");
function snipeCommand(name, description, kind) {
    const data = new discord_js_1.SlashCommandBuilder().setName(name).setDescription(description);
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
            const entry = kind === 'deleted' ? (0, snipe_1.getDeleted)(interaction.channelId, retentionMs) : (0, snipe_1.getEdited)(interaction.channelId, retentionMs);
            if (!entry) {
                await (0, v2_1.v2Reply)(interaction, 'Nothing to snipe here.', { ephemeral: true });
                return;
            }
            await (0, v2_1.v2Reply)(interaction, `**${entry.authorName}**\n${entry.content.slice(0, 1500)}`);
        },
        async prefixExecute(message, _args, app) {
            const retentionMs = app.config.ops.snipe_retention_seconds * 1000;
            const entry = kind === 'deleted' ? (0, snipe_1.getDeleted)(message.channelId, retentionMs) : (0, snipe_1.getEdited)(message.channelId, retentionMs);
            if (!entry) {
                await message.reply({ content: 'Nothing to snipe here.' });
                return;
            }
            await message.reply({ content: `**${entry.authorName}**\n${entry.content.slice(0, 1500)}` });
        },
    };
}
exports.default = [snipeCommand('snipe', 'Recall the last deleted message', 'deleted'), snipeCommand('editsnipe', 'Recall the last edited message', 'edited')];
//# sourceMappingURL=snipe.js.map