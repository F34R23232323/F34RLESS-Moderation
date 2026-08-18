import type { Message, PartialMessage } from 'discord.js';

interface SnipeEntry {
  content: string;
  authorId: string;
  authorName: string;
  timestamp: number;
  channelId: string;
}

const deleted = new Map<string, SnipeEntry>();
const edited = new Map<string, SnipeEntry>();

export function captureDeleted(message: Message | PartialMessage): void {
  if (!message.content || !message.author) return;
  deleted.set(message.channelId, {
    content: message.content,
    authorId: message.author.id,
    authorName: message.author.username,
    timestamp: Date.now(),
    channelId: message.channelId,
  });
}

export function captureEdited(oldMessage: Message | PartialMessage, newMessage: Message | PartialMessage): void {
  if (!oldMessage.content || !newMessage.content || !oldMessage.author) return;
  if (oldMessage.content === newMessage.content) return;
  edited.set(newMessage.channelId, {
    content: oldMessage.content,
    authorId: oldMessage.author.id,
    authorName: oldMessage.author.username,
    timestamp: Date.now(),
    channelId: newMessage.channelId,
  });
}

export function getDeleted(channelId: string, retentionMs: number): SnipeEntry | null {
  const entry = deleted.get(channelId);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > retentionMs) {
    deleted.delete(channelId);
    return null;
  }
  return entry;
}

export function getEdited(channelId: string, retentionMs: number): SnipeEntry | null {
  const entry = edited.get(channelId);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > retentionMs) {
    edited.delete(channelId);
    return null;
  }
  return entry;
}