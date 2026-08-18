import type { GuildBan } from 'discord.js';
import type { App } from '../core/context';
export declare function handleGuildBanRemove(app: App, ban: GuildBan): Promise<void>;
declare const _default: {
    name: string;
    run: typeof handleGuildBanRemove;
};
export default _default;
