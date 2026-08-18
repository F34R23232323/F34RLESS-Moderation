"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const v2_1 = require("../../utils/v2");
const discord_1 = require("../../utils/discord");
const data = new discord_js_1.SlashCommandBuilder()
    .setName('unban')
    .setDescription('Unban a user')
    .addUserOption((o) => o.setName('user').setDescription('Target user').setRequired(true))
    .addStringOption((o) => o.setName('reason').setDescription('Reason').setRequired(false));
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
    const reason = interaction.options.getString('reason') ?? 'No reason provided';
    const result = await app.punishmentManager.unban(guild, user.id, { reason, moderatorId: interaction.user.id });
    if (!result.ok) {
        await (0, v2_1.v2Reply)(interaction, `Failed: ${result.error}`, { ephemeral: true });
        return;
    }
    await (0, v2_1.v2Reply)(interaction, `Unbanned <@${user.id}> — case #${result.case.case_number}.`);
}
async function prefixExecute(message, args, app) {
    const guild = message.guild;
    const targetId = args[0]?.replace(/[<@!>]/g, '');
    const reason = args.slice(1).join(' ') || 'No reason provided';
    if (!guild || !targetId) {
        await message.reply({ content: 'Usage: `!unban <user> <reason>`' });
        return;
    }
    const result = await app.punishmentManager.unban(guild, targetId, { reason, moderatorId: message.author.id });
    await message.reply({ content: result.ok ? `Unbanned <@${targetId}> — case #${result.case.case_number}.` : `Failed: ${result.error}` });
}
const command = {
    name: 'unban',
    category: 'moderation',
    description: 'Unban a user',
    data,
    permissions: ['BanMembers'],
    aliases: [],
    execute,
    prefixExecute,
};
exports.default = command;
//# sourceMappingURL=unban.js.map