"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runMigrations = runMigrations;
async function runMigrations(pool, migrations) {
    const applied = [];
    await pool.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id VARCHAR(255) PRIMARY KEY,
      applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
    const [rows] = await pool.query('SELECT id FROM _migrations');
    const migrationRows = rows;
    const done = new Set(migrationRows.map((r) => r.id));
    for (const migration of migrations) {
        if (done.has(migration.id))
            continue;
        const conn = await pool.getConnection();
        try {
            await conn.beginTransaction();
            await migration.up(conn);
            await conn.query('INSERT INTO _migrations (id) VALUES (?)', [migration.id]);
            await conn.commit();
            applied.push(migration.id);
        }
        catch (err) {
            await conn.rollback();
            throw new Error(`Migration ${migration.id} failed: ${err.message}`);
        }
        finally {
            conn.release();
        }
    }
    return applied;
}
//# sourceMappingURL=migrationRunner.js.map