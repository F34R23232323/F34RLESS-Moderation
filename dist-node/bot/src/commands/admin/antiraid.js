"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const v2_1 = require("../../utils/v2");
const data = new discord_js_1.SlashCommandBuilder()
    .setName('antiraid')
    .setDescription('Manually trigger or disable anti-raid mode')
    .addStringOption((o) => o.setName('action').setDescription('trigger or disarm').addChoices({ name: 'trigger', value: 'trigger' }, { name: 'disarm', value: 'disarm' }).setRequired(true));
async function execute(interaction, app) {
    await interaction.deferReply();
    const guild = interaction.guild;
    if (!guild)
        return;
    const action = interaction.options.getString('action', true);
    if (action === 'trigger') {
        await app.antiRaid.trigger(guild.id);
        await (0, v2_1.v2Reply)(interaction, 'Anti-raid mode triggered.');
    }
    else {
        await app.db.execute('UPDATE gates SET state = \'verified\' WHERE guild_id = ?', [guild.id]);
        await (0, v2_1.v2Reply)(interaction, 'Anti-raid mode disarmed (gates reset).');
    }
}
async function prefixExecute(message, args, app) {
    const guild = message.guild;
    if (!guild)
        return;
    const action = args[0] ?? 'trigger';
    if (action === 'trigger') {
        await app.antiRaid.trigger(guild.id);
        await message.reply({ content: 'Anti-raid mode triggered.' });
    }
    else {
        await message.reply({ content: 'Anti-raid mode disarmed.' });
    }
}
const command = {
    name: 'antiraid',
    category: 'admin',
    description: 'Manually trigger or disable anti-raid mode',
    data,
    permissions: ['ManageGuild'],
    aliases: ['raidmode'],
    execute,
    prefixExecute,
};
exports.default = command;
//# sourceMappingURL=antiraid.js.map