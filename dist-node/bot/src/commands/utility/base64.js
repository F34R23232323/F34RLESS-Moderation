"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const v2_1 = require("../../utils/v2");
const data = new discord_js_1.SlashCommandBuilder()
    .setName('base64')
    .setDescription('Base64 encode/decode')
    .addStringOption((o) => o.setName('mode').setDescription('encode or decode').addChoices({ name: 'encode', value: 'encode' }, { name: 'decode', value: 'decode' }).setRequired(true))
    .addStringOption((o) => o.setName('text').setDescription('Text').setRequired(true));
async function execute(interaction, app) {
    const mode = interaction.options.getString('mode', true);
    const text = interaction.options.getString('text', true);
    const result = mode === 'encode' ? Buffer.from(text).toString('base64') : Buffer.from(text, 'base64').toString('utf8');
    await (0, v2_1.v2Reply)(interaction, `\`${result.slice(0, 1500)}\``, { ephemeral: true });
}
async function prefixExecute(message, args, app) {
    const mode = args[0] ?? 'encode';
    const text = args.slice(1).join(' ');
    if (!text) {
        await message.reply({ content: 'Usage: `!base64 <encode|decode> <text>`' });
        return;
    }
    const result = mode === 'decode' ? Buffer.from(text, 'base64').toString('utf8') : Buffer.from(text).toString('base64');
    await message.reply({ content: result.slice(0, 1500) });
}
const command = {
    name: 'base64',
    category: 'utility',
    description: 'Base64 encode/decode',
    data,
    permissions: [],
    aliases: ['b64'],
    execute,
    prefixExecute,
};
exports.default = command;
//# sourceMappingURL=base64.js.map