export declare function isValidSnowflake(id: string): boolean;
export declare function snowflakeToDate(id: string | bigint): Date | null;
export declare function generateSnowflake(date?: Date): string;
export declare function encodeUserIdTimestamp(ms: number): string;
