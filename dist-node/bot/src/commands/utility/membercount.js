"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const v2_1 = require("../../utils/v2");
const data = new discord_js_1.SlashCommandBuilder()
    .setName('membercount')
    .setDescription('Live member count (humans/bots)');
async function execute(interaction, app) {
    const guild = interaction.guild;
    if (!guild)
        return;
    const humans = guild.members.cache.filter((m) => !m.user.bot).size;
    const bots = guild.members.cache.filter((m) => m.user.bot).size;
    await (0, v2_1.v2Reply)(interaction, `Members: **${guild.memberCount}** (${humans} humans, ${bots} bots)`);
}
async function prefixExecute(message, _args, app) {
    const guild = message.guild;
    if (!guild)
        return;
    await message.reply({ content: `Members: **${guild.memberCount}**` });
}
const command = {
    name: 'membercount',
    category: 'utility',
    description: 'Live member count (humans/bots)',
    data,
    permissions: [],
    aliases: ['mc'],
    execute,
    prefixExecute,
};
exports.default = command;
//# sourceMappingURL=membercount.js.map