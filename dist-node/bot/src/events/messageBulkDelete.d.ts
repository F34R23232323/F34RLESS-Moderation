import type { Collection, Message, PartialMessage } from 'discord.js';
import type { App } from '../core/context';
export declare function handleMessageBulkDelete(app: App, messages: Collection<string, Message | PartialMessage>, channel: {
    guildId: string | null;
    id: string;
}): Promise<void>;
declare const _default: {
    name: string;
    run: typeof handleMessageBulkDelete;
};
export default _default;
