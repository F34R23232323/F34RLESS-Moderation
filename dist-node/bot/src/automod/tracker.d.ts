export declare class MessageTracker {
    private readonly store;
    private readonly limit;
    push(key: string, timestamp?: number): number;
    countInWindow(key: string, windowMs: number, now?: number): number;
    timestampsInWindow(key: string, windowMs: number, now?: number): number[];
    clear(key: string): void;
}
