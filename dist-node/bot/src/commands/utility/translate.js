"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const v2_1 = require("../../utils/v2");
const data = new discord_js_1.SlashCommandBuilder()
    .setName('translate')
    .setDescription('Translate text (free Google endpoint, no key required)')
    .addStringOption((o) => o.setName('text').setDescription('Text to translate').setRequired(true))
    .addStringOption((o) => o.setName('target').setDescription('Target language code, e.g. en, es, de').setRequired(false));
async function execute(interaction, app) {
    await interaction.deferReply({ ephemeral: true });
    const text = interaction.options.getString('text', true);
    const target = interaction.options.getString('target') ?? 'en';
    try {
        const res = await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${target}&dt=t&q=${encodeURIComponent(text.slice(0, 1000))}`);
        if (!res.ok)
            throw new Error(`HTTP ${res.status}`);
        const json = (await res.json());
        const translated = json[0].map((seg) => seg[0]).join('');
        await (0, v2_1.v2Reply)(interaction, `**Original:**\n${text.slice(0, 800)}\n\n**Translated (${target}):**\n${translated}`, { ephemeral: true });
    }
    catch (err) {
        await (0, v2_1.v2Reply)(interaction, `Translation failed: ${err.message}`, { ephemeral: true });
    }
}
async function prefixExecute(message, args, app) {
    const text = args.join(' ');
    if (!text) {
        await message.reply({ content: 'Usage: `!translate <text>`' });
        return;
    }
    const res = await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=en&dt=t&q=${encodeURIComponent(text.slice(0, 1000))}`);
    if (!res.ok) {
        await message.reply({ content: 'Translation failed.' });
        return;
    }
    const json = (await res.json());
    const translated = json[0].map((seg) => seg[0]).join('');
    await message.reply({ content: translated.slice(0, 1500) });
}
const command = {
    name: 'translate',
    category: 'utility',
    description: 'Translate text',
    data,
    permissions: [],
    aliases: ['tr'],
    execute,
    prefixExecute,
};
exports.default = command;
//# sourceMappingURL=translate.js.map