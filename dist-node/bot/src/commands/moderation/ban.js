"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const v2_1 = require("../../utils/v2");
const discord_1 = require("../../utils/discord");
const index_1 = require("../../../../shared/src/index");
const data = new discord_js_1.SlashCommandBuilder()
    .setName('ban')
    .setDescription('Ban a user (optionally temporary)')
    .addUserOption((o) => o.setName('user').setDescription('Target user').setRequired(true))
    .addStringOption((o) => o.setName('reason').setDescription('Reason').setRequired(false))
    .addStringOption((o) => o.setName('duration').setDescription('Optional temporary ban, e.g. 7d').setRequired(false))
    .addIntegerOption((o) => o.setName('delete_days').setDescription('Days of messages to delete').setMinValue(0).setMaxValue(7).setRequired(false));
async function execute(interaction, app) {
    await interaction.deferReply();
    const guild = interaction.guild;
    if (!guild)
        return;
    const user = await (0, discord_1.resolveUserOption)(interaction, app);
    if (!user) {
        await (0, v2_1.v2Reply)(interaction, 'User not found.', { ephemeral: true });
        return;
    }
    const member = await guild.members.fetch(user.id).catch(() => null);
    if (member && interaction.member) {
        const guard = app.modGuard.canModerate(member, interaction.member);
        if (!guard.ok) {
            await (0, v2_1.v2Reply)(interaction, `Cannot ban: ${guard.reason}`, { ephemeral: true });
            return;
        }
    }
    const reason = interaction.options.getString('reason') ?? 'No reason provided';
    const durationStr = interaction.options.getString('duration');
    const durationMs = durationStr ? ((0, index_1.parseDuration)(durationStr)?.milliseconds ?? 0) : 0;
    const deleteDays = interaction.options.getInteger('delete_days') ?? 0;
    const result = await app.punishmentManager.ban(user, {
        reason,
        moderatorId: interaction.user.id,
        durationMs: durationMs > 0 ? durationMs : undefined,
        deleteMessageDays: deleteDays,
    });
    if (!result.ok) {
        await (0, v2_1.v2Reply)(interaction, `Failed: ${result.error}`, { ephemeral: true });
        return;
    }
    const dur = durationMs > 0 ? ` for ${(0, index_1.humanizeDuration)(durationMs)}` : '';
    await (0, v2_1.v2Reply)(interaction, `Banned <@${user.id}>${dur} — case #${result.case.case_number}.`);
}
async function prefixExecute(message, args, app) {
    const guild = message.guild;
    const targetId = args[0]?.replace(/[<@!>]/g, '');
    const durationStr = args[1];
    const reason = args.slice(2).join(' ') || 'No reason provided';
    if (!guild || !targetId) {
        await message.reply({ content: 'Usage: `!ban <user> [duration] <reason>`' });
        return;
    }
    const durationMs = durationStr ? ((0, index_1.parseDuration)(durationStr)?.milliseconds ?? 0) : 0;
    const result = await app.punishmentManager.ban(targetId, {
        reason,
        moderatorId: message.author.id,
        durationMs: durationMs > 0 ? durationMs : undefined,
    });
    await message.reply({ content: result.ok ? `Banned <@${targetId}> — case #${result.case.case_number}.` : `Failed: ${result.error}` });
}
const command = {
    name: 'ban',
    category: 'moderation',
    description: 'Ban a user (optionally temporary)',
    data,
    permissions: ['BanMembers'],
    aliases: ['b', 'bann'],
    execute,
    prefixExecute,
};
exports.default = command;
//# sourceMappingURL=ban.js.map