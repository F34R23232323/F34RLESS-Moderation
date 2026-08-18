import type { App } from '../core/context';
export declare class SlowmodeScheduler {
    private readonly app;
    private readonly tracker;
    private readonly reverted;
    constructor(app: App);
    onMessage(channelId: string): void;
    private applySlowmode;
    private revert;
    revertLoop(): void;
    private entries;
}
