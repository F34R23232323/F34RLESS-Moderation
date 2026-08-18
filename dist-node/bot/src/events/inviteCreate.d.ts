import type { Invite } from 'discord.js';
import type { App } from '../core/context';
export declare function handleInviteCreate(app: App, invite: Invite): Promise<void>;
declare const _default: {
    name: string;
    run: typeof handleInviteCreate;
};
export default _default;
