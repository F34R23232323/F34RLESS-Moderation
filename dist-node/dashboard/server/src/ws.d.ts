import type { Server } from 'http';
import type { Pool } from 'mysql2/promise';
export declare function createWebSocketServer(httpServer: Server, db: Pool, sessionSecret: string): void;
