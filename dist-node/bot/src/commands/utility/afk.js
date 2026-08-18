"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const v2_1 = require("../../utils/v2");
const data = new discord_js_1.SlashCommandBuilder()
    .setName('afk')
    .setDescription('Set or clear your AFK status')
    .addStringOption((o) => o.setName('reason').setDescription('AFK reason').setRequired(false));
async function execute(interaction, app) {
    const guild = interaction.guild;
    if (!guild)
        return;
    const reason = interaction.options.getString('reason');
    if (reason) {
        await app.db.execute(`INSERT INTO afk (user_id, guild_id, reason) VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE reason = VALUES(reason), since = NOW(), cleared = 0`, [interaction.user.id, guild.id, reason]);
        await (0, v2_1.v2Reply)(interaction, `AFK set: ${reason}`);
    }
    else {
        await app.db.execute('UPDATE afk SET cleared = 1 WHERE user_id = ? AND guild_id = ?', [interaction.user.id, guild.id]);
        await (0, v2_1.v2Reply)(interaction, 'AFK cleared.');
    }
}
async function prefixExecute(message, args, app) {
    const guild = message.guild;
    if (!guild)
        return;
    const reason = args.join(' ');
    if (reason) {
        await app.db.execute(`INSERT INTO afk (user_id, guild_id, reason) VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE reason = VALUES(reason), since = NOW(), cleared = 0`, [message.author.id, guild.id, reason]);
        await message.reply({ content: `AFK set: ${reason}` });
    }
    else {
        await app.db.execute('UPDATE afk SET cleared = 1 WHERE user_id = ? AND guild_id = ?', [message.author.id, guild.id]);
        await message.reply({ content: 'AFK cleared.' });
    }
}
const command = {
    name: 'afk',
    category: 'utility',
    description: 'Set or clear your AFK status',
    data,
    permissions: [],
    aliases: [],
    execute,
    prefixExecute,
};
exports.default = command;
//# sourceMappingURL=afk.js.map