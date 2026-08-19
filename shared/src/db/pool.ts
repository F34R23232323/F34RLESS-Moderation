import { createPool, type Pool, type PoolOptions } from 'mysql2/promise';

export function createDbPool(connectionString: string, extra: Partial<PoolOptions> = {}): Pool {
  // acquireTimeout is supported at runtime by mysql2 but missing from its typings.
  const options = {
    uri: connectionString,
    connectionLimit: 30,
    charset: 'utf8mb4',
    dateStrings: false,
    waitForConnections: true,
    connectTimeout: 10_000,
    acquireTimeout: 20_000,
    queueLimit: 200,
    idleTimeout: 60_000,
    enableKeepAlive: true,
    ...extra,
  } as PoolOptions;
  return createPool(options);
}

export async function ping(pool: Pool): Promise<boolean> {
  try {
    await pool.query('SELECT 1');
    return true;
  } catch {
    return false;
  }
}

export async function waitForDb(pool: Pool, timeoutMs = 60_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let lastError: Error | undefined;
  while (Date.now() < deadline) {
    if (await ping(pool)) return;
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  throw new Error(`Database not reachable within ${timeoutMs}ms: ${lastError?.message ?? 'unknown error'}`);
}

export interface QueryRow {
  [key: string]: unknown;
}