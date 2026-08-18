import { type Pool, type PoolOptions } from 'mysql2/promise';
export declare function createDbPool(connectionString: string, extra?: Partial<PoolOptions>): Pool;
export declare function ping(pool: Pool): Promise<boolean>;
export declare function waitForDb(pool: Pool, timeoutMs?: number): Promise<void>;
export interface QueryRow {
    [key: string]: unknown;
}
