"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const v2_1 = require("../../utils/v2");
function formatUptime(ms) {
    const s = Math.floor(ms / 1000);
    const d = Math.floor(s / 86400);
    const h = Math.floor((s % 86400) / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return `${d}d ${h}h ${m}m ${sec}s`;
}
const data = new discord_js_1.SlashCommandBuilder()
    .setName('uptime')
    .setDescription('Bot uptime');
async function execute(interaction, app) {
    await interaction.deferReply();
    await (0, v2_1.v2Reply)(interaction, `Uptime: ${formatUptime(Date.now() - app.startedAt)}`);
}
async function prefixExecute(message, _args, app) {
    await message.reply({ content: `Uptime: ${formatUptime(Date.now() - app.startedAt)}` });
}
const command = {
    name: 'uptime',
    category: 'utility',
    description: 'Bot uptime',
    data,
    permissions: [],
    aliases: [],
    execute,
    prefixExecute,
};
exports.default = command;
//# sourceMappingURL=uptime.js.map