import type { Message } from 'discord.js';
import type { App } from '../core/context';
export declare function handleMessageCreate(app: App, message: Message): Promise<void>;
declare const _default: {
    name: string;
    run: typeof handleMessageCreate;
};
export default _default;
