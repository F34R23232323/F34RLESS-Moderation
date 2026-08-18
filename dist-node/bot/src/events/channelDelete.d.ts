import type { GuildChannel } from 'discord.js';
import type { App } from '../core/context';
export declare function handleChannelDelete(app: App, channel: GuildChannel): Promise<void>;
declare const _default: {
    name: string;
    run: typeof handleChannelDelete;
};
export default _default;
