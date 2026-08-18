"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const v2_1 = require("../../utils/v2");
const discord_1 = require("../../utils/discord");
const index_1 = require("../../../../shared/src/index");
const data = new discord_js_1.SlashCommandBuilder()
    .setName('timeout')
    .setDescription('Apply a timeout to a user')
    .addUserOption((o) => o.setName('user').setDescription('Target user').setRequired(true))
    .addStringOption((o) => o.setName('duration').setDescription('Duration like 30m, 2h').setRequired(true))
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
        await (0, v2_1.v2Reply)(interaction, `Cannot timeout: ${guard.reason}`, { ephemeral: true });
        return;
    }
    const duration = (0, index_1.parseDuration)(interaction.options.getString('duration', true));
    if (!duration || duration.isPermanent) {
        await (0, v2_1.v2Reply)(interaction, 'Provide a valid duration (e.g. 30m, 2h).', { ephemeral: true });
        return;
    }
    const reason = interaction.options.getString('reason') ?? 'No reason provided';
    const result = await app.punishmentManager.timeout(resolved.member, duration.milliseconds, { reason, moderatorId: interaction.user.id });
    if (!result.ok) {
        await (0, v2_1.v2Reply)(interaction, `Failed: ${result.error}`, { ephemeral: true });
        return;
    }
    await (0, v2_1.v2Reply)(interaction, `Timed out <@${resolved.user.id}> — case #${result.case.case_number}.`);
}
async function prefixExecute(message, args, app) {
    const guild = message.guild;
    const targetId = args[0]?.replace(/[<@!>]/g, '');
    const durationStr = args[1];
    const reason = args.slice(2).join(' ') || 'No reason provided';
    if (!guild || !targetId || !durationStr) {
        await message.reply({ content: 'Usage: `!timeout <user> <duration> <reason>`' });
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
    const result = await app.punishmentManager.timeout(member, duration.milliseconds, { reason, moderatorId: message.author.id });
    await message.reply({ content: result.ok ? `Timed out <@${targetId}> — case #${result.case.case_number}.` : `Failed: ${result.error}` });
}
const command = {
    name: 'timeout',
    category: 'moderation',
    description: 'Apply a timeout to a user',
    data,
    permissions: ['ModerateMembers'],
    aliases: ['to'],
    execute,
    prefixExecute,
};
exports.default = command;
//# sourceMappingURL=timeout.js.map