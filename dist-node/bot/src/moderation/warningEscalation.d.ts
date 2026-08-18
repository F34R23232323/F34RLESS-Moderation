import type { App } from '../core/context';
export declare class WarningEscalation {
    private readonly app;
    private readonly applied;
    constructor(app: App);
    check(guildId: string, userId: string): Promise<void>;
}
