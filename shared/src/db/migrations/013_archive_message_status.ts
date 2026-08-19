import type { Migration } from '../migrationRunner';
import type { RowDataPacket } from 'mysql2/promise';

// Adds a per-message status column to archive_messages so combined auto-archives
// can label each message as deleted / edited-before / edited-after.
export const migration013: Migration = {
  id: '013_archive_message_status',
  up: async (conn) => {
    const [cols] = await conn.query<RowDataPacket[]>(
      "SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'archive_messages' AND COLUMN_NAME = 'status'",
    );
    if (cols.length === 0) {
      await conn.query('ALTER TABLE archive_messages ADD COLUMN status VARCHAR(16) NULL AFTER position');
    }
  },
};
