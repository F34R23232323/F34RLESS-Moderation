"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const v2_1 = require("../../utils/v2");
const data = new discord_js_1.SlashCommandBuilder()
    .setName('unlock')
    .setDescription('Unlock channels locked with a named preset (byte-for-byte restore)')
    .addStringOption((o) => o.setName('preset').setDescription('Preset name').setRequired(true));
async function execute(interaction, app) {
    await interaction.deferReply();
    const preset = interaction.options.getString('preset', true);
    try {
        const result = await app.lockingService.unlock(preset);
        await (0, v2_1.v2Reply)(interaction, `Unlocked **${result.unlocked}** channel(s) with preset \`${preset}\`.${result.failed > 0 ? ` ${result.failed} failed.` : ''}`);
    }
    catch (err) {
        await (0, v2_1.v2Reply)(interaction, `Failed: ${err.message}`, { ephemeral: true });
    }
}
async function prefixExecute(message, args, app) {
    const preset = args[0];
    if (!preset) {
        await message.reply({ content: 'Usage: `!unlock <preset>`' });
        return;
    }
    const result = await app.lockingService.unlock(preset);
    await message.reply({ content: `Unlocked **${result.unlocked}** channel(s).` });
}
const command = {
    name: 'unlock',
    category: 'moderation',
    description: 'Unlock channels locked with a named preset (byte-for-byte restore)',
    data,
    permissions: ['ManageChannels'],
    aliases: [],
    execute,
    prefixExecute,
};
exports.default = command;
//# sourceMappingURL=unlock.js.map