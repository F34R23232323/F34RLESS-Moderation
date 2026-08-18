"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const v2_1 = require("../../utils/v2");
const data = new discord_js_1.SlashCommandBuilder()
    .setName('serverinfo')
    .setDescription('Server info: members, channels, roles, boost tier');
async function execute(interaction, app) {
    await interaction.deferReply();
    const guild = interaction.guild;
    if (!guild)
        return;
    const humans = guild.members.cache.filter((m) => !m.user.bot).size;
    const bots = guild.members.cache.filter((m) => m.user.bot).size;
    const text = guild.channels.cache.filter((c) => c.isTextBased()).size;
    const voice = guild.channels.cache.filter((c) => c.isVoiceBased()).size;
    const lines = [
        `**${guild.name}**`,
        `Owner: ${(await guild.fetchOwner().catch(() => null))?.user.tag ?? 'unknown'}`,
        `Created: <t:${Math.floor(guild.createdTimestamp / 1000)}:f>`,
        `Members: ${guild.memberCount} (humans ${humans}, bots ${bots})`,
        `Channels: ${text} text, ${voice} voice, ${guild.channels.cache.filter((c) => c.type === 4).size} categories`,
        `Roles: ${guild.roles.cache.size}`,
        `Boost tier: ${guild.premiumTier} (${guild.premiumSubscriptionCount ?? 0} boosts)`,
        `Verification: ${guild.verificationLevel}`,
        `Features: ${guild.features.slice(0, 10).join(', ') || 'none'}`,
    ];
    await (0, v2_1.v2Reply)(interaction, lines.join('\n'), { imageUrl: guild.iconURL({ size: 256 }) ?? undefined });
}
async function prefixExecute(message, _args, app) {
    const guild = message.guild;
    if (!guild)
        return;
    await message.reply({ content: `**${guild.name}** — ${guild.memberCount} members, tier ${guild.premiumTier}, created <t:${Math.floor(guild.createdTimestamp / 1000)}:D>. Run \`/serverinfo\` for full details.` });
}
const command = {
    name: 'serverinfo',
    category: 'utility',
    description: 'Server info: members, channels, roles, boost tier',
    data,
    permissions: [],
    aliases: ['si', 'guildinfo'],
    execute,
    prefixExecute,
};
exports.default = command;
//# sourceMappingURL=serverinfo.js.map