"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const v2_1 = require("../../utils/v2");
const discord_1 = require("../../utils/discord");
const index_1 = require("../../../../shared/src/index");
const data = new discord_js_1.SlashCommandBuilder()
    .setName('temprole')
    .setDescription('Apply a role for a duration (auto-removes)')
    .addUserOption((o) => o.setName('user').setDescription('Target user').setRequired(true))
    .addRoleOption((o) => o.setName('role').setDescription('Role to apply').setRequired(true))
    .addStringOption((o) => o.setName('duration').setDescription('Duration like 1h, 7d').setRequired(true))
    .addStringOption((o) => o.setName('reason').setDescription('Reason').setRequired(false));
async function execute(interaction, app) {
    await interaction.deferReply();
    const guild = interaction.guild;
    if (!guild)
        return;
    const resolved = await (0, discord_1.resolveMemberOption)(interaction, guild, app);
    const role = interaction.options.getRole('role');
    if (!resolved?.member || !role) {
        await (0, v2_1.v2Reply)(interaction, 'User or role not found.', { ephemeral: true });
        return;
    }
    const guard = app.modGuard.isAboveRole(interaction.member, role);
    if (!guard.ok) {
        await (0, v2_1.v2Reply)(interaction, `Cannot use that role: ${guard.reason}`, { ephemeral: true });
        return;
    }
    const duration = (0, index_1.parseDuration)(interaction.options.getString('duration', true));
    if (!duration || duration.isPermanent) {
        await (0, v2_1.v2Reply)(interaction, 'Provide a valid duration.', { ephemeral: true });
        return;
    }
    const reason = interaction.options.getString('reason') ?? `Temporary role ${role.name}`;
    const result = await app.punishmentManager.tempRole(resolved.member, role.id, duration.milliseconds, { reason, moderatorId: interaction.user.id });
    if (!result.ok) {
        await (0, v2_1.v2Reply)(interaction, `Failed: ${result.error}`, { ephemeral: true });
        return;
    }
    await (0, v2_1.v2Reply)(interaction, `Applied <@&${role.id}> to <@${resolved.user.id}> for ${duration.milliseconds / 60000} minutes.`);
}
async function prefixExecute(message, args, app) {
    const guild = message.guild;
    const targetId = args[0]?.replace(/[<@!>]/g, '');
    const roleId = args[1]?.replace(/[<@&>]/g, '');
    const durationStr = args[2];
    const reason = args.slice(3).join(' ') || 'Temporary role';
    if (!guild || !targetId || !roleId || !durationStr) {
        await message.reply({ content: 'Usage: `!temprole <user> <role> <duration> <reason>`' });
        return;
    }
    const member = await guild.members.fetch(targetId).catch(() => null);
    if (!member) {
        await message.reply({ content: 'User not found.' });
        return;
    }
    const duration = (0, index_1.parseDuration)(durationStr);
    if (!duration || duration.isPermanent) {
        await message.reply({ content: 'Provide a valid duration.' });
        return;
    }
    const result = await app.punishmentManager.tempRole(member, roleId, duration.milliseconds, { reason, moderatorId: message.author.id });
    await message.reply({ content: result.ok ? `Applied <@&${roleId}> to <@${targetId}>.` : `Failed: ${result.error}` });
}
const command = {
    name: 'temprole',
    category: 'moderation',
    description: 'Apply a role for a duration (auto-removes)',
    data,
    permissions: ['ManageRoles'],
    aliases: ['tr'],
    execute,
    prefixExecute,
};
exports.default = command;
//# sourceMappingURL=temprole.js.map