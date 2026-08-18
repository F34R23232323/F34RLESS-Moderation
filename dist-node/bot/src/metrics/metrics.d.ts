import type { App } from '../core/context';
export interface MetricsSnapshot {
    messagesProcessed: number;
    messagesPerSecond: number;
    automodTriggersLastHour: number;
    commandsExecuted: number;
    commandsFailed: number;
    activeCooldowns: number;
    uptimeSeconds: number;
    memoryMB: number;
}
export declare class Metrics {
    private readonly app;
    private messagesProcessed;
    private readonly automodTriggers;
    private commandsExecuted;
    private commandsFailed;
    private readonly startTime;
    private readonly window;
    constructor(app: App);
    incMessages(): void;
    incAutomodTrigger(): void;
    incCommand(success: boolean): void;
    snapshot(): MetricsSnapshot;
    hourlyVolume(): number;
    private push;
}
