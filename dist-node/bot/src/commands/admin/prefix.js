"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const v2_1 = require("../../utils/v2");
const data = new discord_js_1.SlashCommandBuilder()
    .setName('prefix')
    .setDescription('View or set the guild prefix (owner only)')
    .addStringOption((o) => o.setName('prefix').setDescription('New prefix').setRequired(false));
async function execute(interaction, app) {
    const guild = interaction.guild;
    if (!guild)
        return;
    if (!app.modGuard.isOwner(interaction.user.id)) {
        await (0, v2_1.v2Reply)(interaction, 'Owner only.', { ephemeral: true });
        return;
    }
    const newPrefix = interaction.options.getString('prefix');
    if (newPrefix) {
        await app.db.execute(`INSERT INTO custom_config (guild_id, key_name, value) VALUES (?, 'prefix', ?)
       ON DUPLICATE KEY UPDATE value = VALUES(value)`, [guild.id, JSON.stringify({ prefixes: [newPrefix] })]);
        await (0, v2_1.v2Reply)(interaction, `Prefix set to \`${newPrefix}\`.`);
        return;
    }
    const override = app.config.bot.per_guild_prefixes[guild.id] ?? null;
    await (0, v2_1.v2Reply)(interaction, `Prefixes: ${(override ?? app.config.bot.prefixes).map((p) => `\`${p}\``).join(', ')}`);
}
async function prefixExecute(message, args, app) {
    if (!message.guild)
        return;
    if (!app.modGuard.isOwner(message.author.id)) {
        await message.reply({ content: 'Owner only.' });
        return;
    }
    const newPrefix = args[0];
    if (!newPrefix) {
        await message.reply({ content: `Usage: !prefix <new-prefix>` });
        return;
    }
    await app.db.execute(`INSERT INTO custom_config (guild_id, key_name, value) VALUES (?, 'prefix', ?)
     ON DUPLICATE KEY UPDATE value = VALUES(value)`, [message.guild.id, JSON.stringify({ prefixes: [newPrefix] })]);
    await message.reply({ content: `Prefix set to \`${newPrefix}\`.` });
}
const command = {
    name: 'prefix',
    category: 'admin',
    description: 'View or set the guild prefix (owner only)',
    data,
    permissions: ['ManageGuild'],
    aliases: [],
    execute,
    prefixExecute,
};
exports.default = command;
//# sourceMappingURL=prefix.js.map