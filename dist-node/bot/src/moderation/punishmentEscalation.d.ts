import type { App } from '../core/context';
export declare class PunishmentEscalation {
    private readonly app;
    constructor(app: App);
    recordTrigger(guildId: string, userId: string, rule: string): Promise<void>;
    private evaluate;
}
