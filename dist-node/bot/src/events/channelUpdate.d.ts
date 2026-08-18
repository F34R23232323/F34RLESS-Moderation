import type { GuildChannel } from 'discord.js';
import type { App } from '../core/context';
export declare function handleChannelUpdate(app: App, oldChannel: GuildChannel, newChannel: GuildChannel): Promise<void>;
declare const _default: {
    name: string;
    run: typeof handleChannelUpdate;
};
export default _default;
