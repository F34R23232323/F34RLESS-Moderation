"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const v2_1 = require("../../utils/v2");
const data = new discord_js_1.SlashCommandBuilder()
    .setName('botinfo')
    .setDescription('Bot info: version, memory, shards');
async function execute(interaction, app) {
    await interaction.deferReply();
    const pkg = require('../../../../package.json');
    const mem = process.memoryUsage();
    const lines = [
        `f34rless-moderation v${pkg.version}`,
        `Node ${process.version}`,
        `Memory: ${Math.round(mem.rss / 1024 / 1024)}MB RSS / ${Math.round(mem.heapUsed / 1024 / 1024)}MB heap`,
        `Shards: ${app.client.shard?.count ?? 1}`,
        `Guilds: ${app.client.guilds.cache.size}`,
        `Commands loaded: ${app.commands.size}`,
        `Started: <t:${Math.floor(app.startedAt / 1000)}:R>`,
    ];
    await (0, v2_1.v2Reply)(interaction, lines.join('\n'));
}
async function prefixExecute(message, _args, app) {
    await message.reply({ content: `f34rless-moderation — ${app.commands.size} commands, ${app.client.guilds.cache.size} guilds.` });
}
const command = {
    name: 'botinfo',
    category: 'utility',
    description: 'Bot info: version, memory, shards',
    data,
    permissions: [],
    aliases: ['bi'],
    execute,
    prefixExecute,
};
exports.default = command;
//# sourceMappingURL=botinfo.js.map