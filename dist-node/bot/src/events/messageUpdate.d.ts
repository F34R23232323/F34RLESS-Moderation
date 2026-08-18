import type { Message, PartialMessage } from 'discord.js';
import type { App } from '../core/context';
export declare function handleMessageUpdate(app: App, oldMessage: Message | PartialMessage, newMessage: Message | PartialMessage): Promise<void>;
declare const _default: {
    name: string;
    run: typeof handleMessageUpdate;
};
export default _default;
