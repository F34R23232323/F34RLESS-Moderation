import type { Message, PartialMessage } from 'discord.js';
interface SnipeEntry {
    content: string;
    authorId: string;
    authorName: string;
    timestamp: number;
    channelId: string;
}
export declare function captureDeleted(message: Message | PartialMessage): void;
export declare function captureEdited(oldMessage: Message | PartialMessage, newMessage: Message | PartialMessage): void;
export declare function getDeleted(channelId: string, retentionMs: number): SnipeEntry | null;
export declare function getEdited(channelId: string, retentionMs: number): SnipeEntry | null;
export {};
