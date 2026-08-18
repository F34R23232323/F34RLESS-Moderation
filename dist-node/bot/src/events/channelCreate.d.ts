import type { GuildChannel } from 'discord.js';
import type { App } from '../core/context';
export declare function handleChannelCreate(app: App, channel: GuildChannel): Promise<void>;
declare const _default: {
    name: string;
    run: typeof handleChannelCreate;
};
export default _default;
