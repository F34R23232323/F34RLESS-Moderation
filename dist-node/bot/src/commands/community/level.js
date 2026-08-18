"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const v2_1 = require("../../utils/v2");
const data = new discord_js_1.SlashCommandBuilder()
    .setName('level')
    .setDescription('Check your level')
    .addUserOption((o) => o.setName('user').setDescription('Target user').setRequired(false));
async function execute(interaction, app) {
    const guild = interaction.guild;
    if (!guild)
        return;
    const user = interaction.options.getUser('user') ?? interaction.user;
    const [rows] = await app.db.query('SELECT xp, level FROM levels WHERE guild_id = ? AND user_id = ?', [guild.id, user.id]);
    const row = rows[0];
    if (!row) {
        await (0, v2_1.v2Reply)(interaction, `<@${user.id}> has no XP yet.`);
        return;
    }
    await (0, v2_1.v2Reply)(interaction, `<@${user.id}> — level **${row.level}** (${row.xp} XP)`);
}
const command = {
    name: 'level',
    category: 'community',
    description: 'Check your level',
    data,
    permissions: [],
    aliases: ['rank', 'xp'],
    execute,
};
exports.default = command;
//# sourceMappingURL=level.js.map