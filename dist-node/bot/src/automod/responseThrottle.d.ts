export interface ThrottleDecision {
    suppressSend: boolean;
    shouldSummarize: boolean;
}
export declare class ResponseThrottle {
    private readonly entries;
    shouldSuppress(rule: string, channelId: string, userId: string, suppressSeconds: number, mode: 'silent' | 'batched_summary'): ThrottleDecision;
    consumeSummary(rule: string, channelId: string): {
        count: number;
        users: number;
    } | null;
    private flush;
}
