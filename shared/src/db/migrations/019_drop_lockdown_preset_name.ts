import type { Migration } from '../migrationRunner';

export const migration019: Migration = {
  id: '019_drop_lockdown_preset_name',
  up: async (conn) => {
    await conn.query(`ALTER TABLE lockdown_snapshots DROP COLUMN preset_name`);
  },
};
