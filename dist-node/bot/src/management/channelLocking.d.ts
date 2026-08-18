import type { App } from '../core/context';
export declare class LockingService {
    private readonly app;
    constructor(app: App);
    lock(presetName: string): Promise<{
        locked: number;
        failed: number;
    }>;
    unlock(presetName: string): Promise<{
        unlocked: number;
        failed: number;
    }>;
    private snapshot;
}
