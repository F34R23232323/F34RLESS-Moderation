"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const v2_1 = require("../../utils/v2");
const discord_1 = require("../../utils/discord");
const data = new discord_js_1.SlashCommandBuilder()
    .setName('kick')
    .setDescription('Kick a user from the server')
    .addUserOption((o) => o.setName('user').setDescription('Target user').setRequired(true))
    .addStringOption((o) => o.setName('reason').setDescription('Reason').setRequired(false));
async function execute(interaction, app) {
    await interaction.deferReply();
    const guild = interaction.guild;
    if (!guild)
        return;
    const resolved = await (0, discord_1.resolveMemberOption)(interaction, guild, app);
    if (!resolved?.member) {
        await (0, v2_1.v2Reply)(interaction, 'User not found in this server.', { ephemeral: true });
        return;
    }
    const guard = app.modGuard.canModerate(resolved.member, interaction.member);
    if (!guard.ok) {
        await (0, v2_1.v2Reply)(interaction, `Cannot kick: ${guard.reason}`, { ephemeral: true });
        return;
    }
    const reason = interaction.options.getString('reason') ?? 'No reason provided';
    const result = await app.punishmentManager.kick(resolved.member, { reason, moderatorId: interaction.user.id });
    if (!result.ok) {
        await (0, v2_1.v2Reply)(interaction, `Failed: ${result.error}`, { ephemeral: true });
        return;
    }
    await (0, v2_1.v2Reply)(interaction, `Kicked <@${resolved.user.id}> — case #${result.case.case_number}.`);
}
async function prefixExecute(message, args, app) {
    const guild = message.guild;
    const targetId = args[0]?.replace(/[<@!>]/g, '');
    const reason = args.slice(1).join(' ') || 'No reason provided';
    if (!guild || !targetId) {
        await message.reply({ content: 'Usage: `!kick <user> <reason>`' });
        return;
    }
    const member = await guild.members.fetch(targetId).catch(() => null);
    if (!member) {
        await message.reply({ content: 'User not found.' });
        return;
    }
    const guard = app.modGuard.canModerate(member, message.member);
    if (!guard.ok) {
        await message.reply({ content: `Cannot kick: ${guard.reason}` });
        return;
    }
    const result = await app.punishmentManager.kick(member, { reason, moderatorId: message.author.id });
    await message.reply({ content: result.ok ? `Kicked <@${targetId}> — case #${result.case.case_number}.` : `Failed: ${result.error}` });
}
const command = {
    name: 'kick',
    category: 'moderation',
    description: 'Kick a user from the server',
    data,
    permissions: ['KickMembers'],
    aliases: ['k', 'kik'],
    execute,
    prefixExecute,
};
exports.default = command;
//# sourceMappingURL=kick.js.map