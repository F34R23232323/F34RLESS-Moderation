"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.captureDeleted = captureDeleted;
exports.captureEdited = captureEdited;
exports.getDeleted = getDeleted;
exports.getEdited = getEdited;
const deleted = new Map();
const edited = new Map();
function captureDeleted(message) {
    if (!message.content || !message.author)
        return;
    deleted.set(message.channelId, {
        content: message.content,
        authorId: message.author.id,
        authorName: message.author.username,
        timestamp: Date.now(),
        channelId: message.channelId,
    });
}
function captureEdited(oldMessage, newMessage) {
    if (!oldMessage.content || !newMessage.content || !oldMessage.author)
        return;
    if (oldMessage.content === newMessage.content)
        return;
    edited.set(newMessage.channelId, {
        content: oldMessage.content,
        authorId: oldMessage.author.id,
        authorName: oldMessage.author.username,
        timestamp: Date.now(),
        channelId: newMessage.channelId,
    });
}
function getDeleted(channelId, retentionMs) {
    const entry = deleted.get(channelId);
    if (!entry)
        return null;
    if (Date.now() - entry.timestamp > retentionMs) {
        deleted.delete(channelId);
        return null;
    }
    return entry;
}
function getEdited(channelId, retentionMs) {
    const entry = edited.get(channelId);
    if (!entry)
        return null;
    if (Date.now() - entry.timestamp > retentionMs) {
        edited.delete(channelId);
        return null;
    }
    return entry;
}
//# sourceMappingURL=snipe.js.map