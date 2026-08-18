"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const v2_1 = require("../../utils/v2");
const discord_1 = require("../../utils/discord");
const data = new discord_js_1.SlashCommandBuilder()
    .setName('snapshot')
    .setDescription('Snapshot a member\'s roles and nickname')
    .addUserOption((o) => o.setName('user').setDescription('Target user').setRequired(true))
    .addStringOption((o) => o.setName('reason').setDescription('Why').setRequired(false));
async function execute(interaction, app) {
    await interaction.deferReply();
    const guild = interaction.guild;
    if (!guild)
        return;
    const resolved = await (0, discord_1.resolveMemberOption)(interaction, guild, app);
    if (!resolved?.member) {
        await (0, v2_1.v2Reply)(interaction, 'User not found.', { ephemeral: true });
        return;
    }
    const roles = resolved.member.roles.cache.filter((r) => r.id !== guild.id && !r.managed).map((r) => r.id);
    const nickname = resolved.member.nickname;
    const reason = interaction.options.getString('reason') ?? null;
    await app.db.execute('INSERT INTO member_snapshots (guild_id, user_id, roles, nickname, reason, taken_by) VALUES (?, ?, ?, ?, ?, ?)', [guild.id, resolved.user.id, JSON.stringify(roles), nickname, reason, interaction.user.id]);
    await (0, v2_1.v2Reply)(interaction, `Snapshot saved for <@${resolved.user.id}> (${roles.length} roles).`);
}
async function prefixExecute(message, args, app) {
    const guild = message.guild;
    const targetId = args[0]?.replace(/[<@!>]/g, '');
    const reason = args.slice(1).join(' ') || null;
    if (!guild || !targetId) {
        await message.reply({ content: 'Usage: `!snapshot <user> <reason>`' });
        return;
    }
    const member = await guild.members.fetch(targetId).catch(() => null);
    if (!member) {
        await message.reply({ content: 'User not found.' });
        return;
    }
    const roles = member.roles.cache.filter((r) => r.id !== guild.id && !r.managed).map((r) => r.id);
    await app.db.execute('INSERT INTO member_snapshots (guild_id, user_id, roles, nickname, reason, taken_by) VALUES (?, ?, ?, ?, ?, ?)', [guild.id, targetId, JSON.stringify(roles), member.nickname, reason, message.author.id]);
    await message.reply({ content: `Snapshot saved for <@${targetId}>.` });
}
const command = {
    name: 'snapshot',
    category: 'moderation',
    description: 'Snapshot a member\'s roles and nickname',
    data,
    permissions: ['ModerateMembers'],
    aliases: [],
    execute,
    prefixExecute,
};
exports.default = command;
//# sourceMappingURL=snapshot.js.map