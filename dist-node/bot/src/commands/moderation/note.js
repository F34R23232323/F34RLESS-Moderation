"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const v2_1 = require("../../utils/v2");
const discord_1 = require("../../utils/discord");
const data = new discord_js_1.SlashCommandBuilder()
    .setName('note')
    .setDescription('Add a staff note to a user (not a punishment)')
    .addUserOption((o) => o.setName('user').setDescription('Target user').setRequired(true))
    .addStringOption((o) => o.setName('note').setDescription('Note content').setRequired(true));
async function execute(interaction, app) {
    const guild = interaction.guild;
    if (!guild)
        return;
    const user = await (0, discord_1.resolveUserOption)(interaction, app);
    const note = interaction.options.getString('note', true);
    if (!user) {
        await (0, v2_1.v2Reply)(interaction, 'User not found.', { ephemeral: true });
        return;
    }
    await app.db.execute('INSERT INTO notes (guild_id, user_id, moderator_id, note) VALUES (?, ?, ?, ?)', [guild.id, user.id, interaction.user.id, note]);
    await (0, v2_1.v2Reply)(interaction, `Note added to <@${user.id}>.`, { ephemeral: true });
}
async function prefixExecute(message, args, app) {
    const guild = message.guild;
    const targetId = args[0]?.replace(/[<@!>]/g, '');
    const note = args.slice(1).join(' ');
    if (!guild || !targetId || !note) {
        await message.reply({ content: 'Usage: `!note <user> <note>`' });
        return;
    }
    await app.db.execute('INSERT INTO notes (guild_id, user_id, moderator_id, note) VALUES (?, ?, ?, ?)', [guild.id, targetId, message.author.id, note]);
    await message.reply({ content: 'Note added.' });
}
const command = {
    name: 'note',
    category: 'moderation',
    description: 'Add a staff note to a user (not a punishment)',
    data,
    permissions: ['ModerateMembers'],
    aliases: [],
    execute,
    prefixExecute,
};
exports.default = command;
//# sourceMappingURL=note.js.map