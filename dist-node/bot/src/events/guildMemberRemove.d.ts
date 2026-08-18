import type { GuildMember } from 'discord.js';
import type { App } from '../core/context';
export declare function handleGuildMemberRemove(app: App, member: GuildMember): Promise<void>;
declare const _default: {
    name: string;
    run: typeof handleGuildMemberRemove;
};
export default _default;
