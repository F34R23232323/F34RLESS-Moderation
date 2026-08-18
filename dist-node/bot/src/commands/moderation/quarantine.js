"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const v2_1 = require("../../utils/v2");
const discord_1 = require("../../utils/discord");
const data = new discord_js_1.SlashCommandBuilder()
    .setName('quarantine')
    .setDescription('Strip roles and apply a restricted role pending investigation')
    .addUserOption((o) => o.setName('user').setDescription('Target user').setRequired(true));
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
    const guard = app.modGuard.canModerate(resolved.member, interaction.member);
    if (!guard.ok) {
        await (0, v2_1.v2Reply)(interaction, `Cannot quarantine: ${guard.reason}`, { ephemeral: true });
        return;
    }
    const restrictedRoleId = app.config.quarantine.restricted_role_id;
    if (!restrictedRoleId) {
        await (0, v2_1.v2Reply)(interaction, 'No restricted role configured (config.yml -> quarantine.restricted_role_id).', { ephemeral: true });
        return;
    }
    const roles = resolved.member.roles.cache.filter((r) => r.id !== guild.id && !r.managed).map((r) => r.id);
    await app.db.execute(`INSERT INTO quarantines (guild_id, user_id, original_roles) VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE original_roles = VALUES(original_roles), active = 1`, [guild.id, resolved.user.id, JSON.stringify(roles)]);
    await resolved.member.roles.set([restrictedRoleId], 'Quarantined');
    await (0, v2_1.v2Reply)(interaction, `Quarantined <@${resolved.user.id}>. Roles stored for restore.`);
}
async function prefixExecute(message, args, app) {
    const guild = message.guild;
    const targetId = args[0]?.replace(/[<@!>]/g, '');
    if (!guild || !targetId) {
        await message.reply({ content: 'Usage: `!quarantine <user>`' });
        return;
    }
    const member = await guild.members.fetch(targetId).catch(() => null);
    if (!member) {
        await message.reply({ content: 'User not found.' });
        return;
    }
    const restrictedRoleId = app.config.quarantine.restricted_role_id;
    if (!restrictedRoleId) {
        await message.reply({ content: 'No restricted role configured.' });
        return;
    }
    const roles = member.roles.cache.filter((r) => r.id !== guild.id && !r.managed).map((r) => r.id);
    await app.db.execute(`INSERT INTO quarantines (guild_id, user_id, original_roles) VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE original_roles = VALUES(original_roles), active = 1`, [guild.id, targetId, JSON.stringify(roles)]);
    await member.roles.set([restrictedRoleId], 'Quarantined');
    await message.reply({ content: `Quarantined <@${targetId}>.` });
}
const command = {
    name: 'quarantine',
    category: 'moderation',
    description: 'Strip roles and apply a restricted role pending investigation',
    data,
    permissions: ['ModerateMembers'],
    aliases: ['q'],
    execute,
    prefixExecute,
};
exports.default = command;
//# sourceMappingURL=quarantine.js.map