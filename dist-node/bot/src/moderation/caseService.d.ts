import type { Pool, RowDataPacket } from 'mysql2/promise';
export interface CaseInput {
    guildId: string;
    type: string;
    userId: string;
    moderatorId: string | null;
    reason: string;
    durationMs?: number | null;
    evidence?: unknown[];
    linkedCaseIds?: number[];
    status?: string;
}
export interface CaseRow extends RowDataPacket {
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
    created_at: Date;
    updated_at: Date;
}
export declare class CaseService {
    private readonly db;
    constructor(db: Pool);
    createCase(input: CaseInput): Promise<CaseRow>;
    nextCaseNumber(guildId: string): Promise<number>;
    getCaseById(id: number): Promise<CaseRow | null>;
    getCaseByNumber(guildId: string, caseNumber: number): Promise<CaseRow | null>;
    listCasesForUser(guildId: string, userId: string, limit?: number): Promise<CaseRow[]>;
    listCases(guildId: string, opts?: {
        type?: string;
        limit?: number;
        offset?: number;
    }): Promise<CaseRow[]>;
    updateReason(id: number, reason: string): Promise<void>;
    voidCase(id: number, reason?: string): Promise<void>;
    setStatus(id: number, status: string): Promise<void>;
    bulkUpdateReason(ids: number[], reason: string): Promise<void>;
    linkCases(guildId: string, caseId: number, linkedIds: number[]): Promise<void>;
    countWarnings(guildId: string, userId: string, activeOnly?: boolean): Promise<number>;
    deactivateWarning(caseId: number): Promise<void>;
}
