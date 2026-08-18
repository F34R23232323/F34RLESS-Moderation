import type { GuildBan } from 'discord.js';
import type { App } from '../core/context';
export declare function handleGuildBanAdd(app: App, ban: GuildBan): Promise<void>;
declare const _default: {
    name: string;
    run: typeof handleGuildBanAdd;
};
export default _default;
