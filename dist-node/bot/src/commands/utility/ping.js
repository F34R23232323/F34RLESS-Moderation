"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const v2_1 = require("../../utils/v2");
const data = new discord_js_1.SlashCommandBuilder()
    .setName('ping')
    .setDescription('Bot latency (WebSocket + REST)');
async function execute(interaction, app) {
    const ws = app.client.ws.ping;
    const sent = Date.now();
    await interaction.deferReply();
    const roundtrip = Date.now() - sent;
    await (0, v2_1.v2Reply)(interaction, `WebSocket: ${Math.round(ws)}ms\nRound-trip: ${roundtrip}ms`);
}
async function prefixExecute(message, _args, app) {
    const ws = app.client.ws.ping;
    const sent = Date.now();
    await message.reply({ content: 'Pinging...' }).then((m) => m.edit({ content: `WebSocket: ${Math.round(ws)}ms | Round-trip: ${Date.now() - sent}ms` }));
}
const command = {
    name: 'ping',
    category: 'utility',
    description: 'Bot latency (WebSocket + REST)',
    data,
    permissions: [],
    aliases: ['pong'],
    execute,
    prefixExecute,
};
exports.default = command;
//# sourceMappingURL=ping.js.map