"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleChannelCreate = handleChannelCreate;
async function handleChannelCreate(app, channel) {
    await app.logManager.log({
        event: 'channel_create',
        guildId: channel.guild.id,
        channelId: channel.id,
        message: `Channel #${channel.name} created`,
        details: { type: channel.type, id: channel.id },
    });
}
exports.default = { name: 'channelCreate', run: handleChannelCreate };
//# sourceMappingURL=channelCreate.js.map