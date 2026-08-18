"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const v2_1 = require("../../utils/v2");
const data = new discord_js_1.SlashCommandBuilder()
    .setName('massban')
    .setDescription('Ban multiple users (IDs or by filter)')
    .addStringOption((o) => o.setName('ids').setDescription('Comma-separated user IDs').setRequired(false))
    .addIntegerOption((o) => o.setName('joined_after_days').setDescription('Ban users who joined after this many days ago').setRequired(false))
    .addBooleanOption((o) => o.setName('no_roles').setDescription('Ban users with no roles').setRequired(false))
    .addStringOption((o) => o.setName('reason').setDescription('Reason').setRequired(false));
async function execute(interaction, app) {
    await interaction.deferReply();
    const guild = interaction.guild;
    if (!guild)
        return;
    const reason = interaction.options.getString('reason') ?? 'Mass action';
    const idsStr = interaction.options.getString('ids');
    const ids = idsStr ? idsStr.split(',').map((s) => s.trim()).filter(Boolean) : [];
    const joinedAfterDays = interaction.options.getInteger('joined_after_days');
    const noRoles = interaction.options.getBoolean('no_roles') ?? false;
    if (ids.length === 0 && joinedAfterDays === null && !noRoles) {
        await (0, v2_1.v2Reply)(interaction, 'Provide `ids`, `joined_after_days`, or `no_roles`.', { ephemeral: true });
        return;
    }
    const members = await guild.members.fetch();
    let targets = [...members.values()].filter((m) => !m.user.bot);
    if (ids.length > 0) {
        targets = targets.filter((m) => ids.includes(m.id));
    }
    if (joinedAfterDays !== null) {
        const cutoff = Date.now() - joinedAfterDays * 86400000;
        targets = targets.filter((m) => m.joinedTimestamp && m.joinedTimestamp > cutoff);
    }
    if (noRoles) {
        targets = targets.filter((m) => m.roles.cache.filter((r) => r.id !== guild.id).size === 0);
    }
    if (targets.length === 0) {
        await (0, v2_1.v2Reply)(interaction, 'No users matched the criteria.', { ephemeral: true });
        return;
    }
    let banned = 0;
    let failed = 0;
    for (const member of targets) {
        const guard = app.modGuard.canModerate(member, interaction.member);
        if (!guard.ok) {
            failed++;
            continue;
        }
        const result = await app.punishmentManager.ban(member, { reason, moderatorId: interaction.user.id, silent: true });
        if (result.ok)
            banned++;
        else
            failed++;
    }
    await app.logManager.log({
        event: 'moderation_action',
        guildId: guild.id,
        actorId: interaction.user.id,
        message: `Mass ban: ${banned} banned, ${failed} failed`,
        details: { banned, failed, reason, criteria: { ids, joinedAfterDays, noRoles } },
    });
    await (0, v2_1.v2Reply)(interaction, `Mass ban complete: **${banned}** banned, **${failed}** failed.`);
}
async function prefixExecute(message, args, app) {
    const guild = message.guild;
    const ids = args[0]?.split(',').map((s) => s.trim()).filter(Boolean) ?? [];
    const reason = args.slice(1).join(' ') || 'Mass action';
    if (!guild || ids.length === 0) {
        await message.reply({ content: 'Usage: `!massban <id1,id2,...> <reason>`' });
        return;
    }
    let banned = 0;
    for (const id of ids) {
        const result = await app.punishmentManager.ban(id, { reason, moderatorId: message.author.id, silent: true });
        if (result.ok)
            banned++;
    }
    await message.reply({ content: `Mass ban complete: **${banned}** banned.` });
}
const command = {
    name: 'massban',
    category: 'moderation',
    description: 'Ban multiple users (IDs or by filter)',
    data,
    permissions: ['BanMembers'],
    aliases: [],
    execute,
    prefixExecute,
};
exports.default = command;
//# sourceMappingURL=massban.js.map