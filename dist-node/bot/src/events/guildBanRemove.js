"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleGuildBanRemove = handleGuildBanRemove;
async function handleGuildBanRemove(app, ban) {
    await app.logManager.log({
        event: 'member_unban',
        guildId: ban.guild.id,
        targetId: ban.user.id,
        message: `<@${ban.user.id}> was unbanned`,
    });
}
exports.default = { name: 'guildBanRemove', run: handleGuildBanRemove };
//# sourceMappingURL=guildBanRemove.js.map