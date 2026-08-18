import type { LogEventName } from '../config/schema';
export interface LogEntry {
    id: number;
    event: LogEventName;
    guildId: string;
    channelId?: string | null;
    actorId?: string | null;
    targetId?: string | null;
    message?: string;
    details?: unknown;
    createdAt: string;
}
export type LogEntryInput = Omit<LogEntry, 'id' | 'createdAt'>;
export interface AutomodLogEntry {
    id: number;
    guildId: string;
    rule: string;
    module: string;
    userId: string;
    channelId: string;
    messageId?: string | null;
    contentSnippet?: string | null;
    storedContent?: string | null;
    actionsTaken: unknown;
    actionsFailed: unknown;
    responseSuppressed: boolean;
    caseIds: unknown;
    createdAt: string;
}
export interface CaseRow {
    id: number;
    case_number: number;
    guild_id: string;
    type: string;
    user_id: string;
    moderator_id: string | null;
    reason: string;
    duration_ms: number | null;
    evidence: unknown;
    linked_case_ids: unknown;
    status: string;
    created_at: string;
    updated_at: string;
}
export interface CasePayload {
    id: number;
    caseNumber: number;
    type: string;
    userId: string;
    moderatorId: string | null;
    reason: string;
    durationMs: number | null;
    evidence: unknown[];
    linkedCaseIds: number[];
    status: string;
    createdAt: string;
    updatedAt: string;
}
