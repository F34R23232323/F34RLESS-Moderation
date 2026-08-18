"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const v2_1 = require("../../utils/v2");
const discord_1 = require("../../utils/discord");
const data = new discord_js_1.SlashCommandBuilder()
    .setName('softban')
    .setDescription('Ban and immediately unban to purge messages')
    .addUserOption((o) => o.setName('user').setDescription('Target user').setRequired(true))
    .addStringOption((o) => o.setName('reason').setDescription('Reason').setRequired(false))
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
            await (0, v2_1.v2Reply)(interaction, `Cannot softban: ${guard.reason}`, { ephemeral: true });
            return;
        }
    }
    const reason = interaction.options.getString('reason') ?? 'No reason provided';
    const deleteDays = interaction.options.getInteger('delete_days') ?? 7;
    const result = await app.punishmentManager.softban(user, { reason, moderatorId: interaction.user.id, deleteMessageDays: deleteDays });
    if (!result.ok) {
        await (0, v2_1.v2Reply)(interaction, `Failed: ${result.error}`, { ephemeral: true });
        return;
    }
    await (0, v2_1.v2Reply)(interaction, `Softbanned <@${user.id}> — case #${result.case.case_number}.`);
}
async function prefixExecute(message, args, app) {
    const guild = message.guild;
    const targetId = args[0]?.replace(/[<@!>]/g, '');
    const reason = args.slice(1).join(' ') || 'No reason provided';
    if (!guild || !targetId) {
        await message.reply({ content: 'Usage: `!softban <user> <reason>`' });
        return;
    }
    const result = await app.punishmentManager.softban(targetId, { reason, moderatorId: message.author.id });
    await message.reply({ content: result.ok ? `Softbanned <@${targetId}> — case #${result.case.case_number}.` : `Failed: ${result.error}` });
}
const command = {
    name: 'softban',
    category: 'moderation',
    description: 'Ban and immediately unban to purge messages',
    data,
    permissions: ['BanMembers'],
    aliases: ['sb'],
    execute,
    prefixExecute,
};
exports.default = command;
//# sourceMappingURL=softban.js.map