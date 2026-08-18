import { GuildMember } from 'discord.js';
import type { Guild, User } from 'discord.js';
import type { App } from '../core/context';
import type { CaseRow } from './caseService';
export interface PunishOptions {
    reason?: string;
    durationMs?: number | null;
    moderatorId?: string | null;
    evidence?: unknown[];
    deleteMessageDays?: number;
    silent?: boolean;
}
export interface PunishResult {
    ok: boolean;
    case?: CaseRow;
    error?: string;
    dmSent: boolean;
}
export declare class PunishmentManager {
    private readonly app;
    constructor(app: App);
    private dmBefore;
    private dmAfter;
    warn(target: GuildMember | User, options: PunishOptions): Promise<PunishResult>;
    timeout(target: GuildMember, durationMs: number, options: PunishOptions): Promise<PunishResult>;
    unmute(target: GuildMember, options: PunishOptions): Promise<PunishResult>;
    kick(target: GuildMember, options: PunishOptions): Promise<PunishResult>;
    ban(target: GuildMember | User, options: PunishOptions): Promise<PunishResult>;
    unban(guild: Guild, userId: string, options: PunishOptions): Promise<PunishResult>;
    softban(target: GuildMember | User, options: PunishOptions): Promise<PunishResult>;
    tempRole(target: GuildMember, roleId: string, durationMs: number, options: PunishOptions): Promise<PunishResult>;
    applyFromAction(guild: Guild, type: string, target: GuildMember | User, options: PunishOptions): Promise<PunishResult>;
    private resolveGuild;
}
