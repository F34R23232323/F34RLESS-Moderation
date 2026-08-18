"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleMessageBulkDelete = handleMessageBulkDelete;
async function handleMessageBulkDelete(app, messages, channel) {
    try {
        await app.logManager.log({
            event: 'message_bulk_delete',
            guildId: channel.guildId ?? '0',
            channelId: channel.id,
            message: `Bulk deleted ${messages.size} messages in <#${channel.id}>`,
            details: { count: messages.size },
        });
    }
    catch (err) {
        app.logger.error('messageBulkDelete handler threw:', err);
    }
}
exports.default = { name: 'messageDeleteBulk', run: handleMessageBulkDelete };
//# sourceMappingURL=messageBulkDelete.js.map