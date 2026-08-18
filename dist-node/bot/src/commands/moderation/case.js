"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const v2_1 = require("../../utils/v2");
const data = new discord_js_1.SlashCommandBuilder()
    .setName('case')
    .setDescription('View or manage a case')
    .addSubcommand((s) => s.setName('view').setDescription('View a case').addIntegerOption((o) => o.setName('case_id').setDescription('Case number').setRequired(true)))
    .addSubcommand((s) => s.setName('edit').setDescription('Edit a case reason').addIntegerOption((o) => o.setName('case_id').setDescription('Case number').setRequired(true)).addStringOption((o) => o.setName('reason').setDescription('New reason').setRequired(true)))
    .addSubcommand((s) => s.setName('void').setDescription('Void a case').addIntegerOption((o) => o.setName('case_id').setDescription('Case number').setRequired(true)).addStringOption((o) => o.setName('reason').setDescription('Why voiding').setRequired(false)))
    .addSubcommand((s) => s.setName('link').setDescription('Link two cases').addIntegerOption((o) => o.setName('case_id').setDescription('Case number').setRequired(true)).addIntegerOption((o) => o.setName('other_id').setDescription('Other case number').setRequired(true)))
    .addSubcommand((s) => s.setName('bulk_edit').setDescription('Edit reason on multiple cases').addStringOption((o) => o.setName('ids').setDescription('Comma-separated case numbers').setRequired(true)).addStringOption((o) => o.setName('reason').setDescription('New reason').setRequired(true)));
async function execute(interaction, app) {
    await interaction.deferReply();
    const guild = interaction.guild;
    if (!guild)
        return;
    const sub = interaction.options.getSubcommand();
    if (sub === 'view') {
        const num = interaction.options.getInteger('case_id', true);
        const c = await app.caseService.getCaseByNumber(guild.id, num);
        if (!c) {
            await (0, v2_1.v2Reply)(interaction, `Case #${num} not found.`, { ephemeral: true });
            return;
        }
        await (0, v2_1.v2Reply)(interaction, [
            `**Case #${c.case_number}** (${c.status})`,
            `Type: ${c.type}`,
            `User: <@${c.user_id}>`,
            `Moderator: ${c.moderator_id ? `<@${c.moderator_id}>` : 'system'}`,
            `Reason: ${c.reason}`,
            c.duration_ms ? `Duration: ${c.duration_ms}ms` : '',
            `Created: ${new Date(c.created_at).toISOString()}`,
        ].filter(Boolean).join('\n'));
    }
    else if (sub === 'edit') {
        const num = interaction.options.getInteger('case_id', true);
        const reason = interaction.options.getString('reason', true);
        const c = await app.caseService.getCaseByNumber(guild.id, num);
        if (!c) {
            await (0, v2_1.v2Reply)(interaction, `Case #${num} not found.`, { ephemeral: true });
            return;
        }
        await app.caseService.updateReason(c.id, reason);
        await app.logManager.log({ event: 'case_edit', guildId: guild.id, actorId: interaction.user.id, targetId: c.user_id, message: `Case #${num} reason edited`, details: { newReason: reason } });
        await (0, v2_1.v2Reply)(interaction, `Case #${num} updated.`);
    }
    else if (sub === 'void') {
        const num = interaction.options.getInteger('case_id', true);
        const reason = interaction.options.getString('reason');
        const c = await app.caseService.getCaseByNumber(guild.id, num);
        if (!c) {
            await (0, v2_1.v2Reply)(interaction, `Case #${num} not found.`, { ephemeral: true });
            return;
        }
        await app.caseService.voidCase(c.id, reason ?? undefined);
        if (c.type === 'warn')
            await app.caseService.deactivateWarning(c.id);
        await (0, v2_1.v2Reply)(interaction, `Case #${num} voided.`);
    }
    else if (sub === 'link') {
        const num = interaction.options.getInteger('case_id', true);
        const other = interaction.options.getInteger('other_id', true);
        const c = await app.caseService.getCaseByNumber(guild.id, num);
        const o = await app.caseService.getCaseByNumber(guild.id, other);
        if (!c || !o) {
            await (0, v2_1.v2Reply)(interaction, 'One or both cases not found.', { ephemeral: true });
            return;
        }
        await app.caseService.linkCases(guild.id, c.id, [o.id]);
        await (0, v2_1.v2Reply)(interaction, `Linked case #${num} and #${other}.`);
    }
    else if (sub === 'bulk_edit') {
        const ids = interaction.options.getString('ids', true).split(',').map((s) => s.trim()).map(Number).filter(Boolean);
        const reason = interaction.options.getString('reason', true);
        const resolved = [];
        for (const id of ids) {
            const c = await app.caseService.getCaseByNumber(guild.id, id);
            if (c)
                resolved.push(c.id);
        }
        await app.caseService.bulkUpdateReason(resolved, reason);
        await (0, v2_1.v2Reply)(interaction, `Updated ${resolved.length} case(s).`);
    }
}
async function prefixExecute(message, args, app) {
    const guild = message.guild;
    if (!guild)
        return;
    const sub = args[0] ?? 'view';
    const num = Number(args[1]);
    if (sub === 'view' && num) {
        const c = await app.caseService.getCaseByNumber(guild.id, num);
        await message.reply({ content: c ? `Case #${c.case_number} (${c.status}) — ${c.type} — <@${c.user_id}> — ${c.reason}` : `Case #${num} not found.` });
        return;
    }
    await message.reply({ content: 'Usage: `!case view <id>` | `!case edit <id> <reason>` | `!case void <id>` | `!case link <id> <id>` | `!case bulk_edit <ids> <reason>`' });
}
const command = {
    name: 'case',
    category: 'moderation',
    description: 'View or manage a case',
    data,
    permissions: ['ModerateMembers'],
    aliases: ['c'],
    execute,
    prefixExecute,
};
exports.default = command;
//# sourceMappingURL=case.js.map