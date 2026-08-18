import type { Invite } from 'discord.js';
import type { App } from '../core/context';
export declare function handleInviteDelete(app: App, invite: Invite): Promise<void>;
declare const _default: {
    name: string;
    run: typeof handleInviteDelete;
};
export default _default;
