import type { GuildMember } from 'discord.js';
import type { App } from '../core/context';
export declare function handleGuildMemberUpdate(app: App, oldMember: GuildMember, newMember: GuildMember): Promise<void>;
declare const _default: {
    name: string;
    run: typeof handleGuildMemberUpdate;
};
export default _default;
