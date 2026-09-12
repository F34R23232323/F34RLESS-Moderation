import { createPool, type Pool, type PoolOptions } from 'mysql2/promise';

/** Hard timeout for every individual pool query.  Without this, a query that
 *  is waiting for a connection or stuck on a slow server will block forever,
 *  eventually starving the entire pool and hanging every HTTP request.
 *  Keep well below the server's 12 s request deadline so a stalled query
 *  resolves with an error before the deadline fires. */
const QUERY_TIMEOUT_MS = 9_000;

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    timer.unref?.();
    promise.then(
      (val) => { clearTimeout(timer); resolve(val); },
      (err) => { clearTimeout(timer); reject(err); },
    );
  });
}

export function createDbPool(connectionString: string, extra: Partial<PoolOptions> = {}): Pool {
  const options = {
    uri: connectionString,
    connectionLimit: 30,
    charset: 'utf8mb4',
    dateStrings: false,
    waitForConnections: true,
    connectTimeout: 10_000,
    queueLimit: 0,
    idleTimeout: 60_000,
    enableKeepAlive: true,
    ...extra,
  } as PoolOptions;
  const pool = createPool(options);

  // Monkey-patch query/execute so every call has a hard deadline.  This is the
  // only reliable way to prevent the pool from hanging in Express 4 (where an
  // unanswered query means a permanently stuck HTTP request).
  const origQuery = pool.query.bind(pool);
  const origExecute = pool.execute.bind(pool);

  (pool as any).query = function (...args: any[]) {
    return withTimeout((origQuery as any)(...args), QUERY_TIMEOUT_MS, 'pool.query');
  };
  (pool as any).execute = function (...args: any[]) {
    return withTimeout((origExecute as any)(...args), QUERY_TIMEOUT_MS, 'pool.execute');
  };

  return pool;
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
