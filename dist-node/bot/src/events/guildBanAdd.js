"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleGuildBanAdd = handleGuildBanAdd;
async function handleGuildBanAdd(app, ban) {
    await app.logManager.log({
        event: 'member_ban',
        guildId: ban.guild.id,
        targetId: ban.user.id,
        message: `<@${ban.user.id}> was banned (${ban.reason ?? 'no reason'})`,
        details: { reason: ban.reason },
    });
}
exports.default = { name: 'guildBanAdd', run: handleGuildBanAdd };
//# sourceMappingURL=guildBanAdd.js.map