import type { Migration } from '../migrationRunner';

export const migration006: Migration = {
  id: '006_guild_channels_position',
  up: async (conn) => {
    await conn.query('ALTER TABLE guild_channels ADD COLUMN position INT NOT NULL DEFAULT 0 AFTER parent_id');
  },
};