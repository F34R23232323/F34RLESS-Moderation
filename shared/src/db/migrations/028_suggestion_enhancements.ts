import type { Migration } from '../migrationRunner';

export const migration028: Migration = {
  id: '028_suggestion_enhancements',
  up: async (conn) => {
    await conn.query(`
      ALTER TABLE suggestions
        ADD COLUMN thread_id VARCHAR(20) NULL AFTER message_id,
        ADD COLUMN handled_by VARCHAR(20) NULL AFTER status,
        ADD COLUMN handled_at DATETIME NULL AFTER handled_by,
        ADD COLUMN note TEXT NULL AFTER handled_at
    `).catch(() => undefined);

    await conn.query(`
      CREATE INDEX idx_suggestions_guild_status ON suggestions (guild_id, status)
    `).catch(() => undefined);
  },
};
