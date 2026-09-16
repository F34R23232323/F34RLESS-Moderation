import type { Message, PartialMessage } from 'discord.js';

export interface SnipeAttachment {
  name: string;
  url: string;
  proxyUrl: string | null;
  size: number;
  contentType: string | null;
}

export interface SnipeEntry {
  content: string;
  authorId: string;
  authorName: string;
  timestamp: number;
  channelId: string;
  attachments: SnipeAttachment[];
  messageId: string;
}

const MAX_PER_CHANNEL = 25;

const deleted = new Map<string, SnipeEntry[]>();
const edited = new Map<string, SnipeEntry[]>();

function pushEntry(store: Map<string, SnipeEntry[]>, entry: SnipeEntry): void {
  const list = store.get(entry.channelId) ?? [];
  list.unshift(entry);
  if (list.length > MAX_PER_CHANNEL) list.length = MAX_PER_CHANNEL;
  store.set(entry.channelId, list);
}

function extractAttachments(message: Message | PartialMessage): SnipeAttachment[] {
  if (!message.attachments || message.attachments.size === 0) return [];
  return [...message.attachments.values()].map((a) => ({
    name: a.name,
    url: a.url,
    proxyUrl: a.proxyURL,
    size: a.size,
    contentType: a.contentType,
  }));
}

export function captureDeleted(message: Message | PartialMessage): void {
  if (!message.author) return;
  const content = message.content ?? '';
  const attachments = extractAttachments(message);
  if (!content && attachments.length === 0) return;
  pushEntry(deleted, {
    content,
    authorId: message.author.id,
    authorName: message.author.username,
    timestamp: Date.now(),
    channelId: message.channelId,
    attachments,
    messageId: message.id,
  });
}

export function captureEdited(oldMessage: Message | PartialMessage, newMessage: Message | PartialMessage): void {
  if (!newMessage.author) return;
  const oldContent = oldMessage.content ?? '';
  const newContent = newMessage.content ?? '';
  if (oldContent === newContent) return;
  if (!oldContent && !newContent) return;
  pushEntry(edited, {
    content: oldContent,
    authorId: newMessage.author.id,
    authorName: newMessage.author.username,
    timestamp: Date.now(),
    channelId: newMessage.channelId,
    attachments: extractAttachments(oldMessage),
    messageId: newMessage.id,
  });
}

export function getDeleted(channelId: string, retentionMs: number, amount: number = 1): SnipeEntry[] {
  const list = deleted.get(channelId);
  if (!list) return [];
  const now = Date.now();
  const valid = list.filter((e) => now - e.timestamp <= retentionMs);
  if (valid.length < list.length) deleted.set(channelId, valid);
  return valid.slice(0, amount);
}

export function getEdited(channelId: string, retentionMs: number, amount: number = 1): SnipeEntry[] {
  const list = edited.get(channelId);
  if (!list) return [];
  const now = Date.now();
  const valid = list.filter((e) => now - e.timestamp <= retentionMs);
  if (valid.length < list.length) edited.set(channelId, valid);
  return valid.slice(0, amount);
}

export function getDeletedAttachments(channelId: string, retentionMs: number, amount: number = 5): SnipeEntry[] {
  const list = deleted.get(channelId);
  if (!list) return [];
  const now = Date.now();
  const withAttachments = list.filter((e) => now - e.timestamp <= retentionMs && e.attachments.length > 0);
  return withAttachments.slice(0, amount);
}
