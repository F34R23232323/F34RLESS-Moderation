import type { App } from '../core/context';
export interface ReportInput {
    guildId: string;
    reporterId: string;
    targetUserId?: string | null;
    targetMessageId?: string | null;
    reason?: string;
}
export declare class ReportingService {
    private readonly app;
    constructor(app: App);
    createReport(input: ReportInput): Promise<{
        id: number;
        merged: boolean;
    }>;
    private findDuplicate;
    private postReportCard;
    getReporterCredibility(guildId: string, userId: string): Promise<{
        actioned: number;
        ignored: number;
        false: number;
    }>;
    resolve(reportId: number, status: 'actioned' | 'ignored' | 'false', resolvedBy: string): Promise<void>;
    private archive;
}
