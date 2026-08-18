"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const v2_1 = require("../../utils/v2");
const discord_1 = require("../../utils/discord");
const data = new discord_js_1.SlashCommandBuilder()
    .setName('restore')
    .setDescription('Restore a member from the latest snapshot')
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
    const [rows] = await app.db.query('SELECT roles, nickname FROM member_snapshots WHERE guild_id = ? AND user_id = ? ORDER BY id DESC LIMIT 1', [guild.id, user.id]);
    const row = rows[0];
    if (!row) {
        await (0, v2_1.v2Reply)(interaction, 'No snapshot found for this user.', { ephemeral: true });
        return;
    }
    const member = await guild.members.fetch(user.id).catch(() => null);
    if (!member) {
        await (0, v2_1.v2Reply)(interaction, 'User is not in the server.', { ephemeral: true });
        return;
    }
    const roles = JSON.parse(row.roles ?? '[]');
    await member.roles.set([...roles, guild.id], 'Snapshot restore');
    if (row.nickname)
        await member.setNickname(row.nickname, 'Snapshot restore').catch(() => undefined);
    await (0, v2_1.v2Reply)(interaction, `Restored <@${user.id}> from snapshot (${roles.length} roles).`);
}
async function prefixExecute(message, args, app) {
    const guild = message.guild;
    const targetId = args[0]?.replace(/[<@!>]/g, '');
    if (!guild || !targetId) {
        await message.reply({ content: 'Usage: `!restore <user>`' });
        return;
    }
    const [rows] = await app.db.query('SELECT roles, nickname FROM member_snapshots WHERE guild_id = ? AND user_id = ? ORDER BY id DESC LIMIT 1', [guild.id, targetId]);
    const row = rows[0];
    if (!row) {
        await message.reply({ content: 'No snapshot found.' });
        return;
    }
    const member = await guild.members.fetch(targetId).catch(() => null);
    if (!member) {
        await message.reply({ content: 'User not in server.' });
        return;
    }
    const roles = JSON.parse(row.roles ?? '[]');
    await member.roles.set([...roles, guild.id], 'Snapshot restore');
    await message.reply({ content: `Restored <@${targetId}> from snapshot.` });
}
const command = {
    name: 'restore',
    category: 'moderation',
    description: 'Restore a member from the latest snapshot',
    data,
    permissions: ['ModerateMembers'],
    aliases: [],
    execute,
    prefixExecute,
};
exports.default = command;
//# sourceMappingURL=restore.js.map