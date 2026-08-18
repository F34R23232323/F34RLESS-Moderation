export declare class CooldownManager {
    private readonly store;
    private readonly ttlMs;
    constructor(ttlMs?: number);
    private key;
    tryConsume(scope: string, id: string, bucket: string, seconds: number): boolean;
    remainingSeconds(scope: string, id: string, bucket: string): number;
    clear(scope: string, id: string, bucket: string): void;
    size(): number;
    private prune;
}
