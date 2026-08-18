import type { Pool } from 'mysql2/promise';
export interface DashboardContext {
    db: Pool;
    ownerUserId: string;
    sessionSecret: string;
    clientId: string;
    clientSecret: string;
    baseUrl: string;
    port: number;
}
export declare function loadDashboardContext(): DashboardContext;
