"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const v2_1 = require("../../utils/v2");
const data = new discord_js_1.SlashCommandBuilder()
    .setName('modstats')
    .setDescription('Moderator activity stats')
    .addIntegerOption((o) => o.setName('days').setDescription('Window in days').setMinValue(1).setMaxValue(90).setRequired(false));
async function execute(interaction, app) {
    await interaction.deferReply();
    const guild = interaction.guild;
    if (!guild)
        return;
    const days = interaction.options.getInteger('days') ?? 30;
    const [rows] = await app.db.query(`SELECT moderator_id, COUNT(*) AS total,
      SUM(CASE WHEN type IN ('ban','kick','mute','warn') THEN 1 ELSE 0 END) AS actions
     FROM cases
     WHERE guild_id = ? AND moderator_id IS NOT NULL AND created_at > DATE_SUB(NOW(), INTERVAL ? DAY)
     GROUP BY moderator_id ORDER BY total DESC LIMIT 20`, [guild.id, days]);
    if (rows.length === 0) {
        await (0, v2_1.v2Reply)(interaction, 'No mod activity in the last ' + days + ' days.');
        return;
    }
    const lines = rows.map((r) => `<@${r.moderator_id}> — ${r.total} case(s) (${r.actions} actions)`);
    await (0, v2_1.v2Reply)(interaction, `**Moderator activity (last ${days} days)**\n${lines.join('\n')}`);
}
async function prefixExecute(message, args, app) {
    const guild = message.guild;
    if (!guild)
        return;
    const days = Number(args[0]) || 30;
    const [rows] = await app.db.query(`SELECT moderator_id, COUNT(*) AS total FROM cases WHERE guild_id = ? AND moderator_id IS NOT NULL AND created_at > DATE_SUB(NOW(), INTERVAL ? DAY) GROUP BY moderator_id ORDER BY total DESC LIMIT 20`, [guild.id, days]);
    await message.reply({ content: rows.length === 0 ? 'No activity.' : `**Moderator activity (last ${days} days)**\n${rows.map((r) => `<@${r.moderator_id}> — ${r.total}`).join('\n')}` });
}
const command = {
    name: 'modstats',
    category: 'moderation',
    description: 'Moderator activity stats',
    data,
    permissions: ['ModerateMembers'],
    aliases: ['modactivity'],
    execute,
    prefixExecute,
};
exports.default = command;
//# sourceMappingURL=modstats.js.map