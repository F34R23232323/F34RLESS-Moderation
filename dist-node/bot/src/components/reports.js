"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
async function resolve(app, interaction, reportId) {
    const guild = interaction.guild;
    const cfg = app.config.reports;
    if (!guild)
        return false;
    const member = interaction.member;
    if (!member)
        return false;
    const allowed = (member.permissions?.has('ModerateMembers') ?? false) ||
        (cfg.action_roles.length > 0 && (member.roles?.cache.some((r) => cfg.action_roles.includes(r.id)) ?? false));
    if (!allowed) {
        await interaction.reply({ content: 'You do not have permission to action reports.', ephemeral: true });
        return false;
    }
    return true;
}
const action = {
    type: 'button',
    id: 'report:action:',
    async run(app, interaction) {
        const reportId = Number(interaction.customId.replace('report:action:', ''));
        if (!(await resolve(app, interaction, reportId)))
            return;
        await app.reporting.resolve(reportId, 'actioned', interaction.user.id);
        await interaction.reply({ content: `Report #${reportId} marked as actioned.`, ephemeral: true });
    },
};
const ignore = {
    type: 'button',
    id: 'report:ignore:',
    async run(app, interaction) {
        const reportId = Number(interaction.customId.replace('report:ignore:', ''));
        if (!(await resolve(app, interaction, reportId)))
            return;
        await app.reporting.resolve(reportId, 'ignored', interaction.user.id);
        await interaction.reply({ content: `Report #${reportId} marked as ignored.`, ephemeral: true });
    },
};
const falseReport = {
    type: 'button',
    id: 'report:false:',
    async run(app, interaction) {
        const reportId = Number(interaction.customId.replace('report:false:', ''));
        if (!(await resolve(app, interaction, reportId)))
            return;
        await app.reporting.resolve(reportId, 'false', interaction.user.id);
        await interaction.reply({ content: `Report #${reportId} marked as a false report.`, ephemeral: true });
    },
};
exports.default = [action, ignore, falseReport];
//# sourceMappingURL=reports.js.map