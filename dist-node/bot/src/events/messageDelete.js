"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleMessageDelete = handleMessageDelete;
const snipe_1 = require("../utils/snipe");
async function handleMessageDelete(app, message) {
    try {
        (0, snipe_1.captureDeleted)(message);
        if (message.author?.bot && !message.author?.id)
            return;
        const content = message.content || '';
        await app.logManager.log({
            event: 'message_delete',
            guildId: message.guildId ?? '0',
            channelId: message.channelId,
            actorId: null,
            targetId: message.author?.id ?? null,
            message: `Message deleted in <#${message.channelId}> by <@${message.author?.id ?? 'unknown'}>`,
            details: { content: content.slice(0, 1500) },
        });
    }
    catch (err) {
        app.logger.error('messageDelete handler threw:', err);
    }
}
exports.default = { name: 'messageDelete', run: handleMessageDelete };
//# sourceMappingURL=messageDelete.js.map