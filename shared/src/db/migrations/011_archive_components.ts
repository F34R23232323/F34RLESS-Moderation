import type { Migration } from '../migrationRunner';
import type { RowDataPacket } from 'mysql2/promise';

export const migration011: Migration = {
  id: '011_archive_components',
  up: async (conn) => {
    const [cols] = await conn.query<RowDataPacket[]>(
      "SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'archive_messages' AND COLUMN_NAME = 'components'",
    );
    if (cols.length === 0) {
      await conn.query('ALTER TABLE archive_messages ADD COLUMN components JSON NULL');
    }
  },
};
