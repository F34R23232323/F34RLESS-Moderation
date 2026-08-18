import type { Pool, PoolConnection, RowDataPacket } from 'mysql2/promise';

export interface Migration {
  id: string;
  up: (conn: PoolConnection) => Promise<void> | void;
}

export async function runMigrations(pool: Pool, migrations: Migration[]): Promise<string[]> {
  const applied: string[] = [];
  await pool.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id VARCHAR(255) PRIMARY KEY,
      applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  const [lockRows] = await pool.query<RowDataPacket[]>(
    "SELECT GET_LOCK('f34rless_migrations', 60) AS locked",
  );
  const locked = lockRows[0]?.locked;
  if (locked !== 1) {
    throw new Error('Could not acquire the migration lock (another instance may be migrating).');
  }

  try {
    const [rows] = await pool.query('SELECT id FROM _migrations');
    const migrationRows = rows as Array<{ id: string }>;
    const done = new Set(migrationRows.map((r) => r.id));

    for (const migration of migrations) {
      if (done.has(migration.id)) continue;
      const conn = await pool.getConnection();
      try {
        await conn.beginTransaction();
        await migration.up(conn);
        await conn.query('INSERT INTO _migrations (id) VALUES (?)', [migration.id]);
        await conn.commit();
        applied.push(migration.id);
      } catch (err) {
        await conn.rollback();
        throw new Error(
          `Migration ${migration.id} failed: ${(err as Error).message}. ` +
            'Note: MySQL DDL commits implicitly, so partially-created tables may remain. ' +
            'On a fresh deploy, reset the database (docker compose down -v) and start again.',
        );
      } finally {
        conn.release();
      }
    }
  } finally {
    await pool.query("SELECT RELEASE_LOCK('f34rless_migrations')");
  }

  return applied;
}