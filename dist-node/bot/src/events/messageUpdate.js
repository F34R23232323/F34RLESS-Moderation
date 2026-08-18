"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleMessageUpdate = handleMessageUpdate;
const snipe_1 = require("../utils/snipe");
async function handleMessageUpdate(app, oldMessage, newMessage) {
    try {
        (0, snipe_1.captureEdited)(oldMessage, newMessage);
        if (!oldMessage.content || !newMessage.content)
            return;
        if (oldMessage.content === newMessage.content)
            return;
        await app.logManager.log({
            event: 'message_edit',
            guildId: newMessage.guildId ?? '0',
            channelId: newMessage.channelId,
            targetId: newMessage.author?.id ?? null,
            message: `Message edited in <#${newMessage.channelId}> by <@${newMessage.author?.id ?? 'unknown'}>`,
            details: { old: oldMessage.content.slice(0, 1000), new: newMessage.content.slice(0, 1000) },
        });
    }
    catch (err) {
        app.logger.error('messageUpdate handler threw:', err);
    }
}
exports.default = { name: 'messageUpdate', run: handleMessageUpdate };
//# sourceMappingURL=messageUpdate.js.map