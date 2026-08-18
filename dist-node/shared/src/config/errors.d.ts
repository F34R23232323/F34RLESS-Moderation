export interface ConfigIssue {
    path: string;
    expected: string;
    found: string;
}
export declare class ConfigValidationError extends Error {
    readonly issues: ConfigIssue[];
    constructor(issues: ConfigIssue[]);
    formatHumanReadable(): string;
}
