import type { Migration } from '../migrationRunner';

const sql = (strings: TemplateStringsArray): string => strings.join('');

export const migration008: Migration = {
  id: '008_reports_detail',
  up: async (conn) => {
    const statements = [
      sql`ALTER TABLE reports
          ADD COLUMN target_content TEXT NULL AFTER reason,
          ADD COLUMN source_channel_id VARCHAR(20) NULL AFTER target_content,
          ADD COLUMN source_module VARCHAR(32) NULL AFTER source_channel_id,
          ADD COLUMN source_rule VARCHAR(64) NULL AFTER source_module,
          ADD COLUMN attachment_urls JSON NULL AFTER source_rule,
          ADD COLUMN resolved_action VARCHAR(16) NULL AFTER resolved_by,
          ADD COLUMN resolved_reason TEXT NULL AFTER resolved_action,
          ADD COLUMN resolved_duration VARCHAR(32) NULL AFTER resolved_reason`,
    ];

    for (const statement of statements) {
      await conn.query(statement);
    }
  },
};
