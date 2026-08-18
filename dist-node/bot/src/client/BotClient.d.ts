import { Client, type ClientOptions } from 'discord.js';
import type { App } from '../core/context';
export declare class BotClient extends Client {
    readonly app: App;
    constructor(app: App, options?: Partial<ClientOptions>);
}
