"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const v2_1 = require("../../utils/v2");
const discord_1 = require("../../utils/discord");
const data = new discord_js_1.SlashCommandBuilder()
    .setName('unquarantine')
    .setDescription('Restore a quarantined user to their original roles')
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
    const [rows] = await app.db.query('SELECT original_roles FROM quarantines WHERE guild_id = ? AND user_id = ? AND active = 1', [guild.id, user.id]);
    const row = rows[0];
    if (!row) {
        await (0, v2_1.v2Reply)(interaction, 'User is not quarantined.', { ephemeral: true });
        return;
    }
    const member = await guild.members.fetch(user.id).catch(() => null);
    const roles = JSON.parse(row.original_roles ?? '[]');
    if (member) {
        await member.roles.set([...roles, guild.id], 'Quarantine lifted').catch(() => undefined);
    }
    await app.db.execute('UPDATE quarantines SET active = 0 WHERE guild_id = ? AND user_id = ?', [guild.id, user.id]);
    await (0, v2_1.v2Reply)(interaction, `Restored <@${user.id}>'s roles.`);
}
async function prefixExecute(message, args, app) {
    const guild = message.guild;
    const targetId = args[0]?.replace(/[<@!>]/g, '');
    if (!guild || !targetId) {
        await message.reply({ content: 'Usage: `!unquarantine <user>`' });
        return;
    }
    const [rows] = await app.db.query('SELECT original_roles FROM quarantines WHERE guild_id = ? AND user_id = ? AND active = 1', [guild.id, targetId]);
    const row = rows[0];
    if (!row) {
        await message.reply({ content: 'User is not quarantined.' });
        return;
    }
    const member = await guild.members.fetch(targetId).catch(() => null);
    const roles = JSON.parse(row.original_roles ?? '[]');
    if (member)
        await member.roles.set([...roles, guild.id], 'Quarantine lifted').catch(() => undefined);
    await app.db.execute('UPDATE quarantines SET active = 0 WHERE guild_id = ? AND user_id = ?', [guild.id, targetId]);
    await message.reply({ content: `Restored <@${targetId}>'s roles.` });
}
const command = {
    name: 'unquarantine',
    category: 'moderation',
    description: 'Restore a quarantined user to their original roles',
    data,
    permissions: ['ModerateMembers'],
    aliases: ['uq'],
    execute,
    prefixExecute,
};
exports.default = command;
//# sourceMappingURL=unquarantine.js.map