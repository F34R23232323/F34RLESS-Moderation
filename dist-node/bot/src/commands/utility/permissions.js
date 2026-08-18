"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const v2_1 = require("../../utils/v2");
const data = new discord_js_1.SlashCommandBuilder()
    .setName('permissions')
    .setDescription('Permission utilities')
    .addSubcommand((s) => s.setName('check').setDescription('Effective permissions in this channel and why').addUserOption((o) => o.setName('user').setDescription('User').setRequired(true)));
async function execute(interaction, app) {
    await interaction.deferReply();
    const guild = interaction.guild;
    if (!guild)
        return;
    const user = interaction.options.getUser('user', true);
    const member = await guild.members.fetch(user.id).catch(() => null);
    if (!member) {
        await (0, v2_1.v2Reply)(interaction, 'User not found.', { ephemeral: true });
        return;
    }
    const channel = interaction.channel;
    if (!channel || !('permissionsFor' in channel)) {
        await (0, v2_1.v2Reply)(interaction, 'Not available here.', { ephemeral: true });
        return;
    }
    const perms = channel.permissionsFor(member);
    const array = perms.toArray();
    const granted = [];
    for (const permName of array) {
        for (const role of member.roles.cache.values()) {
            const rolePerms = role.permissions;
            if (rolePerms.has(permName)) {
                granted.push(`${permName} (from <@&${role.id}>)`);
                break;
            }
        }
    }
    const adminOverride = granted.some((g) => g.startsWith('Administrator'));
    await (0, v2_1.v2Reply)(interaction, `**Effective permissions for <@${user.id}> in <#${channel.id}>**\n${adminOverride ? 'Administrator (all permissions)' : granted.join('\n') || 'no permissions granted'}`);
}
async function prefixExecute(message, args, app) {
    const guild = message.guild;
    const targetId = args[0]?.replace(/[<@!>]/g, '');
    if (!guild || !targetId) {
        await message.reply({ content: 'Usage: `!permissions check <user>`' });
        return;
    }
    const member = await guild.members.fetch(targetId).catch(() => null);
    if (!member) {
        await message.reply({ content: 'User not found.' });
        return;
    }
    const perms = message.channel.permissionsFor?.(member);
    const key = ['BanMembers', 'KickMembers', 'ManageMessages', 'ModerateMembers', 'ManageChannels', 'ManageRoles', 'Administrator'];
    const lines = key.filter((p) => perms?.has(p));
    await message.reply({ content: `<@${targetId}> in <#${message.channelId}>: ${lines.join(', ') || 'no key permissions'}` });
}
const command = {
    name: 'permissions',
    category: 'utility',
    description: 'Permission utilities',
    data,
    permissions: [],
    aliases: ['perms'],
    execute,
    prefixExecute,
};
exports.default = command;
//# sourceMappingURL=permissions.js.map