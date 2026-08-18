import type { MessageReaction, PartialMessageReaction, PartialUser, User } from 'discord.js';
import type { App } from '../core/context';
export declare function handleMessageReactionAdd(app: App, reaction: MessageReaction | PartialMessageReaction, user: User | PartialUser): Promise<void>;
declare const _default: {
    name: string;
    run: typeof handleMessageReactionAdd;
};
export default _default;
