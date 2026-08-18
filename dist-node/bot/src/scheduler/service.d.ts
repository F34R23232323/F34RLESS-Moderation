import type { App } from '../core/context';
export declare class SchedulerService {
    private readonly app;
    private readonly jobs;
    private readonly timers;
    constructor(app: App);
    start(): void;
    addCron(id: string, expression: string, run: () => Promise<void> | void): void;
    setTimeout(id: string, delayMs: number, run: () => Promise<void> | void): void;
    clearTimeout(id: string): void;
    private schedulePunishmentExpiry;
    private scheduleReminders;
    private scheduleLockdowns;
    private scheduleAnnouncements;
    private scheduleBackups;
    private scheduleSlowmodeRevert;
    private scheduleBirthdays;
    private scheduleTrustLevels;
}
