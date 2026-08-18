import type { GuildMember, Role } from 'discord.js';
import type { App } from '../core/context';
import type { BotCommand } from '../types/command';
export interface GuardResult {
    ok: boolean;
    reason?: string;
}
export declare class ModerationCommandGuard {
    private readonly app;
    constructor(app: App);
    isOwner(userId: string): boolean;
    isImmune(target: GuildMember, command: BotCommand): boolean;
    hasRequiredPermissions(member: GuildMember, command: BotCommand): GuardResult;
    canModerate(target: GuildMember, staff: GuildMember): GuardResult;
    private isHigher;
    isAboveRole(staff: GuildMember, role: Role): GuardResult;
}
