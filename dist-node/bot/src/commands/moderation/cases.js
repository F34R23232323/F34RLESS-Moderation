"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const v2_1 = require("../../utils/v2");
const discord_1 = require("../../utils/discord");
const data = new discord_js_1.SlashCommandBuilder()
    .setName('cases')
    .setDescription('List cases for a user')
    .addUserOption((o) => o.setName('user').setDescription('Target user').setRequired(true));
async function execute(interaction, app) {
    await interaction.deferReply();
    const guild = interaction.guild;
    if (!guild)
        return;
    const user = await (0, discord_1.resolveUserOption)(interaction, app);
    if (!user) {
        await (0, v2_1.v2Reply)(interaction, 'User not found.', { ephemeral: true });
        return;
    }
    const cases = await app.caseService.listCasesForUser(guild.id, user.id);
    if (cases.length === 0) {
        await (0, v2_1.v2Reply)(interaction, `No cases for <@${user.id}>.`);
        return;
    }
    const lines = cases.map((c) => `#${c.case_number} [${c.status}] ${c.type} — ${c.reason} (${new Date(c.created_at).toLocaleDateString()})`);
    await (0, v2_1.v2Reply)(interaction, `**Cases for <@${user.id}>** (${cases.length})\n${lines.slice(0, 25).join('\n')}`);
}
async function prefixExecute(message, args, app) {
    const guild = message.guild;
    const targetId = args[0]?.replace(/[<@!>]/g, '');
    if (!guild || !targetId) {
        await message.reply({ content: 'Usage: `!cases <user>`' });
        return;
    }
    const cases = await app.caseService.listCasesForUser(guild.id, targetId);
    await message.reply({ content: cases.length === 0 ? 'No cases.' : `**Cases for <@${targetId}>**\n${cases.slice(0, 20).map((c) => `#${c.case_number} ${c.type} — ${c.reason}`).join('\n')}` });
}
const command = {
    name: 'cases',
    category: 'moderation',
    description: 'List cases for a user',
    data,
    permissions: ['ModerateMembers'],
    aliases: [],
    execute,
    prefixExecute,
};
exports.default = command;
//# sourceMappingURL=cases.js.map