export interface ParsedDuration {
    milliseconds: number;
    isPermanent: boolean;
}
export declare function parseDuration(input: string): ParsedDuration | null;
export declare function formatDuration(ms: number): string;
export declare function humanizeDuration(ms: number): string;
