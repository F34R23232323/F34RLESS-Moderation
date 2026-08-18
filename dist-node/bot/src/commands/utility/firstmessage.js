"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const v2_1 = require("../../utils/v2");
const data = new discord_js_1.SlashCommandBuilder()
    .setName('firstmessage')
    .setDescription('Jump-link to a channel\'s first message');
async function execute(interaction, app) {
    await interaction.deferReply({ ephemeral: true });
    const channel = interaction.channel;
    if (!channel?.messages) {
        await (0, v2_1.v2Reply)(interaction, 'Not available in this channel.', { ephemeral: true });
        return;
    }
    const messages = (await channel.messages.fetch({ limit: 1 }));
    const first = messages.last();
    if (!first) {
        await (0, v2_1.v2Reply)(interaction, 'No messages found.', { ephemeral: true });
        return;
    }
    await (0, v2_1.v2Reply)(interaction, `First message: https://discord.com/channels/${interaction.guildId}/${interaction.channelId}/${first.id}`);
}
const command = {
    name: 'firstmessage',
    category: 'utility',
    description: 'Jump-link to a channel\'s first message',
    data,
    permissions: [],
    aliases: ['first'],
    execute,
};
exports.default = command;
//# sourceMappingURL=firstmessage.js.map