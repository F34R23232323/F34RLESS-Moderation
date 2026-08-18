"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const v2_1 = require("../../utils/v2");
const data = new discord_js_1.SlashCommandBuilder()
    .setName('roles')
    .setDescription('Role utilities')
    .addSubcommand((s) => s.setName('list').setDescription('List all roles'))
    .addSubcommand((s) => s.setName('members').setDescription('List members of a role').addRoleOption((o) => o.setName('role').setDescription('Role').setRequired(true)));
async function execute(interaction, app) {
    await interaction.deferReply();
    const guild = interaction.guild;
    if (!guild)
        return;
    const sub = interaction.options.getSubcommand();
    if (sub === 'list') {
        const roles = [...guild.roles.cache.values()]
            .filter((r) => r.id !== guild.id)
            .sort((a, b) => b.position - a.position)
            .slice(0, 40);
        await (0, v2_1.v2Reply)(interaction, `**Roles (${guild.roles.cache.size})**\n${roles.map((r) => `<@&${r.id}> (${r.members.size})`).join('\n')}`);
    }
    else if (sub === 'members') {
        const role = interaction.options.getRole('role');
        if (!role)
            return;
        const members = await guild.members.fetch();
        const roleMembers = members.filter((m) => m.roles.cache.has(role.id));
        await (0, v2_1.v2Reply)(interaction, `**<@&${role.id}> members (${roleMembers.size})**\n${roleMembers.first(30).map((m) => `<@${m.id}>`).join(' ') || 'none'}`);
    }
}
async function prefixExecute(message, args, app) {
    const guild = message.guild;
    if (!guild)
        return;
    const sub = args[0] ?? 'list';
    if (sub === 'list') {
        const roles = [...guild.roles.cache.values()].filter((r) => r.id !== guild.id).sort((a, b) => b.position - a.position).slice(0, 40);
        await message.reply({ content: `**Roles**\n${roles.map((r) => `<@&${r.id}> (${r.members.size})`).join('\n')}` });
        return;
    }
    await message.reply({ content: 'Usage: `!roles list` | `!roles members <role>`' });
}
const command = {
    name: 'roles',
    category: 'utility',
    description: 'Role utilities',
    data,
    permissions: [],
    aliases: [],
    execute,
    prefixExecute,
};
exports.default = command;
//# sourceMappingURL=roles.js.map