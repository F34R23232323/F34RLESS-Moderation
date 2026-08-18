"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleGuildMemberRemove = handleGuildMemberRemove;
const v2_1 = require("../utils/v2");
async function handleGuildMemberRemove(app, member) {
    try {
        const guild = member.guild;
        if (app.config.sticky_roles.enabled && !member.user.bot) {
            const roles = member.roles.cache
                .filter((r) => r.id !== guild.id && !r.managed)
                .map((r) => r.id);
            await app.db.execute(`INSERT INTO sticky_roles (guild_id, user_id, roles) VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE roles = VALUES(roles)`, [guild.id, member.id, JSON.stringify(roles)]);
        }
        const cfg = app.config.goodbye;
        if (cfg.enabled && cfg.channel_id) {
            const channel = guild.channels.cache.get(cfg.channel_id);
            if (channel && 'send' in channel) {
                const text = cfg.message
                    .replaceAll('{user}', member.user.username)
                    .replaceAll('{guild}', guild.name);
                await (0, v2_1.v2Send)(channel, text, { accentColor: '#ED4245' }).catch(() => undefined);
            }
        }
        await app.logManager.log({
            event: 'member_leave',
            guildId: guild.id,
            targetId: member.id,
            message: `<@${member.id}> left`,
        });
    }
    catch (err) {
        app.logger.error('guildMemberRemove handler threw:', err);
    }
}
exports.default = { name: 'guildMemberRemove', run: handleGuildMemberRemove };
//# sourceMappingURL=guildMemberRemove.js.map