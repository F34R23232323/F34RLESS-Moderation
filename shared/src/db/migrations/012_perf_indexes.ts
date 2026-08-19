import type { Migration } from '../migrationRunner';
import type { RowDataPacket } from 'mysql2/promise';

// Adds the indexes the dashboard relies on for ordering + filtering the
// high-volume tables (message_snapshots, logs, automod_logs, command_usage).
// Every ALTER is guarded via information_schema so the migration is safe to
// re-run after a partial (DDL-implicit-commit) failure.
export const migration012: Migration = {
  id: '012_perf_indexes',
  up: async (conn) => {
    const ensureIndex = async (table: string, indexName: string, columns: string): Promise<void> => {
      const [rows] = await conn.query<RowDataPacket[]>(
        'SELECT INDEX_NAME FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?',
        [table, indexName],
      );
      if (rows.length === 0) {
        await conn.query(`ALTER TABLE ${table} ADD INDEX ${indexName} (${columns})`);
      }
    };

    await ensureIndex('message_snapshots', 'idx_snap_created', 'created_at');
    await ensureIndex('message_snapshots', 'idx_snap_author', 'author_id, created_at');
    await ensureIndex('message_snapshots', 'idx_snap_channel', 'channel_id, created_at');
    await ensureIndex('logs', 'idx_logs_created', 'created_at');
    await ensureIndex('automod_logs', 'idx_am_logs_created', 'created_at');
    await ensureIndex('command_usage', 'idx_usage_created', 'created_at');
  },
};
