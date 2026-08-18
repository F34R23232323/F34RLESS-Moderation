"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const v2_1 = require("../../utils/v2");
const discord_1 = require("../../utils/discord");
const data = new discord_js_1.SlashCommandBuilder()
    .setName('unmute')
    .setDescription('Remove a mute/timeout from a user')
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
    const reason = interaction.options.getString('reason') ?? 'Mute lifted';
    const result = await app.punishmentManager.unmute(resolved.member, { reason, moderatorId: interaction.user.id });
    if (!result.ok) {
        await (0, v2_1.v2Reply)(interaction, `Failed: ${result.error}`, { ephemeral: true });
        return;
    }
    await (0, v2_1.v2Reply)(interaction, `Unmuted <@${resolved.user.id}> — case #${result.case.case_number}.`);
}
async function prefixExecute(message, args, app) {
    const guild = message.guild;
    const targetId = args[0]?.replace(/[<@!>]/g, '');
    const reason = args.slice(1).join(' ') || 'Mute lifted';
    if (!guild || !targetId) {
        await message.reply({ content: 'Usage: `!unmute <user> <reason>`' });
        return;
    }
    const member = await guild.members.fetch(targetId).catch(() => null);
    if (!member) {
        await message.reply({ content: 'User not found.' });
        return;
    }
    const result = await app.punishmentManager.unmute(member, { reason, moderatorId: message.author.id });
    await message.reply({ content: result.ok ? `Unmuted <@${targetId}> — case #${result.case.case_number}.` : `Failed: ${result.error}` });
}
const command = {
    name: 'unmute',
    category: 'moderation',
    description: 'Remove a mute/timeout from a user',
    data,
    permissions: ['ModerateMembers'],
    aliases: ['um'],
    execute,
    prefixExecute,
};
exports.default = command;
//# sourceMappingURL=unmute.js.map