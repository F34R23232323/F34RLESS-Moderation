import type { Pool, PoolConnection } from 'mysql2/promise';
export interface Migration {
    id: string;
    up: (conn: PoolConnection) => Promise<void> | void;
}
export declare function runMigrations(pool: Pool, migrations: Migration[]): Promise<string[]>;
