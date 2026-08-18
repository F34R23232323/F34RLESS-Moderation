"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleChannelUpdate = handleChannelUpdate;
async function handleChannelUpdate(app, oldChannel, newChannel) {
    const changes = [];
    if (oldChannel.name !== newChannel.name)
        changes.push(`name: ${oldChannel.name} -> ${newChannel.name}`);
    const oldAny = oldChannel;
    const newAny = newChannel;
    if (oldAny.topic !== newAny.topic)
        changes.push('topic changed');
    if (changes.length === 0)
        return;
    await app.logManager.log({
        event: 'channel_update',
        guildId: newChannel.guild.id,
        channelId: newChannel.id,
        message: `Channel #${newChannel.name} updated`,
        details: { changes },
    });
}
exports.default = { name: 'channelUpdate', run: handleChannelUpdate };
//# sourceMappingURL=channelUpdate.js.map