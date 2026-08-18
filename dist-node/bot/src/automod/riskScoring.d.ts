import type { App } from '../core/context';
export declare class RiskScoring {
    private readonly app;
    private readonly cache;
    constructor(app: App);
    add(userId: string, amount: number, guildId?: string): Promise<number>;
    get(userId: string, guildId?: string): number;
    private decayed;
    private triggerThreshold;
}
