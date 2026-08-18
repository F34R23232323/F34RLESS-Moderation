import type { Guild, User } from 'discord.js';
import type { App } from '../core/context';
import type { PunishmentType } from '../../../shared/src/index';
export interface PunishmentDmContext {
    guild: Guild;
    user: User;
    reason?: string;
    moderator?: string;
    durationMs?: number | null;
    caseId?: number;
}
export declare class PunishmentDmManager {
    private readonly app;
    constructor(app: App);
    send(type: PunishmentType, ctx: PunishmentDmContext): Promise<boolean>;
}
