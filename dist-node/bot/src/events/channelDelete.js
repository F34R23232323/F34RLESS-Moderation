"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleChannelDelete = handleChannelDelete;
async function handleChannelDelete(app, channel) {
    await app.logManager.log({
        event: 'channel_delete',
        guildId: channel.guild.id,
        channelId: channel.id,
        message: `Channel #${channel.name} deleted`,
        details: { type: channel.type, id: channel.id },
    });
}
exports.default = { name: 'channelDelete', run: handleChannelDelete };
//# sourceMappingURL=channelDelete.js.map