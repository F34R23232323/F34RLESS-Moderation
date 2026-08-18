import type { App } from '../core/context';
export declare class AntiRaidService {
    private readonly app;
    private active;
    constructor(app: App);
    isActive(guildId: string): boolean;
    trigger(guildId: string): Promise<void>;
    announce(guildId: string, channelId: string): Promise<void>;
}
