import type { Guild, GuildMember, Message, TextChannel, User } from 'discord.js';
import type { App } from '../core/context';
import type { ActionChain } from '../../../shared/src/index';
import type { ResponseThrottle, ThrottleDecision } from './responseThrottle';
export interface ChainTrigger {
    rule: string;
    module: string;
    guild: Guild;
    user: User;
    member?: GuildMember | null;
    message?: Message | null;
    channel?: TextChannel | null;
    reason?: string;
    content?: string;
}
export interface ChainResult {
    actionsTaken: string[];
    actionsFailed: Array<{
        step: string;
        error: string;
    }>;
    caseIds: number[];
    responseSuppressed: boolean;
    suppressDecision: ThrottleDecision | null;
    throttleMode: 'silent' | 'batched_summary';
}
export declare class ActionChainExecutor {
    private readonly app;
    private readonly throttle;
    constructor(app: App, throttle: ResponseThrottle);
    execute(trigger: ChainTrigger, chain: ActionChain, suppressSeconds?: number, suppressMode?: 'silent' | 'batched_summary'): Promise<ChainResult>;
    private executeStep;
    private buildFormatted;
    private sendFormatted;
}
