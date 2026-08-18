import type { GuildMember } from 'discord.js';
import type { App } from '../core/context';
export declare function handleGuildMemberAdd(app: App, member: GuildMember): Promise<void>;
declare const _default: {
    name: string;
    run: typeof handleGuildMemberAdd;
};
export default _default;
