"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const v2_1 = require("../../utils/v2");
const data = new discord_js_1.SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('Level leaderboard')
    .addIntegerOption((o) => o.setName('limit').setDescription('How many to show').setMinValue(1).setMaxValue(50).setRequired(false));
async function execute(interaction, app) {
    await interaction.deferReply();
    const guild = interaction.guild;
    if (!guild)
        return;
    const limit = interaction.options.getInteger('limit') ?? 10;
    const [rows] = await app.db.query('SELECT user_id, xp, level FROM levels WHERE guild_id = ? ORDER BY xp DESC LIMIT ?', [guild.id, limit]);
    if (rows.length === 0) {
        await (0, v2_1.v2Reply)(interaction, 'No level data yet.');
        return;
    }
    const lines = rows.map((r, i) => `${i + 1}. <@${r.user_id}> — level ${r.level} (${r.xp} XP)`);
    await (0, v2_1.v2Reply)(interaction, `**Leaderboard**\n${lines.join('\n')}`);
}
async function prefixExecute(message, args, app) {
    const guild = message.guild;
    if (!guild)
        return;
    const [rows] = await app.db.query('SELECT user_id, xp, level FROM levels WHERE guild_id = ? ORDER BY xp DESC LIMIT 10', [guild.id]);
    await message.reply({ content: rows.length === 0 ? 'No level data yet.' : `**Leaderboard**\n${rows.map((r, i) => `${i + 1}. <@${r.user_id}> — level ${r.level}`).join('\n')}` });
}
const command = {
    name: 'leaderboard',
    category: 'community',
    description: 'Level leaderboard',
    data,
    permissions: [],
    aliases: ['lb'],
    execute,
    prefixExecute,
};
exports.default = command;
//# sourceMappingURL=leaderboard.js.map