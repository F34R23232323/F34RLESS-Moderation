"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleInviteDelete = handleInviteDelete;
async function handleInviteDelete(app, invite) {
    const guildId = invite.guild?.id ?? '0';
    await app.logManager.log({
        event: 'invite_delete',
        guildId,
        channelId: invite.channel?.id ?? null,
        message: `Invite deleted: discord.gg/${invite.code}`,
        details: { code: invite.code },
    });
}
exports.default = { name: 'inviteDelete', run: handleInviteDelete };
//# sourceMappingURL=inviteDelete.js.map