import type { Message, PartialMessage } from 'discord.js';
import type { App } from '../core/context';
export declare function handleMessageDelete(app: App, message: Message | PartialMessage): Promise<void>;
declare const _default: {
    name: string;
    run: typeof handleMessageDelete;
};
export default _default;
