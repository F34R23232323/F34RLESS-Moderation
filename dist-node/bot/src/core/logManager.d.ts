import { EventEmitter } from 'events';
import type { Pool } from 'mysql2/promise';
import type { App } from './context';
import type { LogEventName } from '../../../shared/src/index';
export interface LogInput {
    event: LogEventName;
    guildId: string;
    channelId?: string | null;
    actorId?: string | null;
    targetId?: string | null;
    message?: string;
    details?: unknown;
}
export declare class LogManager extends EventEmitter {
    private readonly db;
    app: App | null;
    constructor(db: Pool);
    log(input: LogInput): Promise<number | null>;
    private routeToDiscord;
    logAutomodTrigger(entry: {
        guildId: string;
        rule: string;
        module: string;
        userId: string;
        channelId?: string | null;
        messageId?: string | null;
        contentSnippet?: string | null;
        storedContent?: string | null;
        actionsTaken: unknown;
        actionsFailed: unknown;
        responseSuppressed: boolean;
        caseIds: number[];
    }): Promise<void>;
    private routeAutomodLogToDiscord;
    logCommandUsage(entry: {
        guildId: string | null;
        command: string;
        userId: string;
        surface: 'slash' | 'prefix';
        success: boolean;
        durationMs?: number;
        error?: string | null;
    }): Promise<void>;
    reportError(source: string, err: unknown): Promise<void>;
    reportRateLimit(data: {
        route: string;
        method: string;
        timeout: number;
        global: boolean;
        bucket?: string | null;
    }): Promise<void>;
    private postWebhook;
}
