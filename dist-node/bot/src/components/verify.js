"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    type: 'button',
    id: 'verify:',
    async run(app, interaction) {
        const cfg = app.config.verification_gate;
        if (!cfg.enabled) {
            await interaction.reply({ content: 'Verification is disabled.', ephemeral: true });
            return;
        }
        const [rows] = await app.db.query("SELECT state FROM gates WHERE guild_id = ? AND user_id = ? AND state = 'pending'", [interaction.guildId, interaction.user.id]);
        if (rows.length === 0) {
            await interaction.reply({ content: 'No pending verification for you.', ephemeral: true });
            return;
        }
        const roleId = cfg.verified_role_id;
        if (!roleId) {
            await interaction.reply({ content: 'No verified role configured.', ephemeral: true });
            return;
        }
        const member = await interaction.guild?.members.fetch(interaction.user.id).catch(() => null);
        if (!member) {
            await interaction.reply({ content: 'Could not find your membership.', ephemeral: true });
            return;
        }
        const role = interaction.guild?.roles.cache.get(roleId);
        const me = interaction.guild?.members.me;
        if (!role || !me || role.position >= me.roles.highest.position) {
            await interaction.reply({ content: 'Verified role is misconfigured (bot role too low).', ephemeral: true });
            return;
        }
        await member.roles.add(roleId, 'Verified via gate');
        await app.db.execute("UPDATE gates SET state = 'verified' WHERE guild_id = ? AND user_id = ?", [interaction.guildId, interaction.user.id]);
        await app.logManager.log({
            event: 'member_join',
            guildId: interaction.guildId,
            targetId: interaction.user.id,
            message: `<@${interaction.user.id}> verified via gate`,
        });
        await interaction.reply({ content: 'You are now verified.', ephemeral: true });
    },
};
//# sourceMappingURL=verify.js.map