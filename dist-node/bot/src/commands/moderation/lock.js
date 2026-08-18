"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const v2_1 = require("../../utils/v2");
const data = new discord_js_1.SlashCommandBuilder()
    .setName('lock')
    .setDescription('Lock channels using a named preset')
    .addStringOption((o) => o.setName('preset').setDescription('Preset name').setRequired(true));
async function execute(interaction, app) {
    await interaction.deferReply();
    const preset = interaction.options.getString('preset', true);
    try {
        const result = await app.lockingService.lock(preset);
        await (0, v2_1.v2Reply)(interaction, `Locked **${result.locked}** channel(s) with preset \`${preset}\`.${result.failed > 0 ? ` ${result.failed} failed.` : ''}`);
    }
    catch (err) {
        await (0, v2_1.v2Reply)(interaction, `Failed: ${err.message}`, { ephemeral: true });
    }
}
async function prefixExecute(message, args, app) {
    const preset = args[0];
    if (!preset) {
        await message.reply({ content: 'Usage: `!lock <preset>`' });
        return;
    }
    const result = await app.lockingService.lock(preset);
    await message.reply({ content: `Locked **${result.locked}** channel(s).` });
}
const command = {
    name: 'lock',
    category: 'moderation',
    description: 'Lock channels using a named preset',
    data,
    permissions: ['ManageChannels'],
    aliases: ['lockdown'],
    execute,
    prefixExecute,
};
exports.default = command;
//# sourceMappingURL=lock.js.map