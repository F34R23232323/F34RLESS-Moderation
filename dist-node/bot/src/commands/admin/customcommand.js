"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const v2_1 = require("../../utils/v2");
const data = new discord_js_1.SlashCommandBuilder()
    .setName('customcommand')
    .setDescription('Manage guild custom commands')
    .addSubcommand((s) => s.setName('add').setDescription('Add a custom command').addStringOption((o) => o.setName('name').setDescription('Command name').setRequired(true)).addStringOption((o) => o.setName('response').setDescription('Response text').setRequired(true)).addStringOption((o) => o.setName('aliases').setDescription('Comma-separated aliases').setRequired(false)))
    .addSubcommand((s) => s.setName('remove').setDescription('Remove a custom command').addStringOption((o) => o.setName('name').setDescription('Command name').setRequired(true)))
    .addSubcommand((s) => s.setName('list').setDescription('List custom commands'));
async function execute(interaction, app) {
    await interaction.deferReply({ ephemeral: true });
    const guild = interaction.guild;
    if (!guild)
        return;
    const sub = interaction.options.getSubcommand();
    const member = interaction.member;
    const isStaff = member?.permissions?.has('ManageMessages') ?? false;
    if (sub === 'add') {
        if (!isStaff) {
            await (0, v2_1.v2Reply)(interaction, 'Staff only.', { ephemeral: true });
            return;
        }
        const name = interaction.options.getString('name', true).toLowerCase();
        const response = interaction.options.getString('response', true);
        const aliases = (interaction.options.getString('aliases') ?? '').split(',').map((s) => s.trim()).filter(Boolean);
        await app.db.execute(`INSERT INTO custom_commands (guild_id, name, aliases, response) VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE response = VALUES(response), aliases = VALUES(aliases)`, [guild.id, name, JSON.stringify(aliases), JSON.stringify({ content: response })]);
        await (0, v2_1.v2Reply)(interaction, `Custom command \`${name}\` added.`, { ephemeral: true });
    }
    else if (sub === 'remove') {
        if (!isStaff) {
            await (0, v2_1.v2Reply)(interaction, 'Staff only.', { ephemeral: true });
            return;
        }
        const name = interaction.options.getString('name', true).toLowerCase();
        await app.db.execute('DELETE FROM custom_commands WHERE guild_id = ? AND name = ?', [guild.id, name]);
        await (0, v2_1.v2Reply)(interaction, `Custom command \`${name}\` removed.`, { ephemeral: true });
    }
    else if (sub === 'list') {
        const [rows] = await app.db.query('SELECT name, aliases FROM custom_commands WHERE guild_id = ? AND enabled = 1 ORDER BY name', [guild.id]);
        if (rows.length === 0) {
            await (0, v2_1.v2Reply)(interaction, 'No custom commands.', { ephemeral: true });
            return;
        }
        const lines = rows.map((r) => `\`${r.name}\`${r.aliases ? ` (${JSON.parse(r.aliases).join(', ')})` : ''}`);
        await (0, v2_1.v2Reply)(interaction, `**Custom commands**\n${lines.join('\n')}`, { ephemeral: true });
    }
}
const command = {
    name: 'customcommand',
    category: 'admin',
    description: 'Manage guild custom commands',
    data,
    permissions: ['ManageMessages'],
    aliases: ['cc'],
    execute,
};
exports.default = command;
//# sourceMappingURL=customcommand.js.map