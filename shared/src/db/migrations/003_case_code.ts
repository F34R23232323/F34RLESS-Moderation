import type { Migration } from '../migrationRunner';

const sql = (strings: TemplateStringsArray): string => strings.join('');

export const migration003: Migration = {
  id: '003_case_code',
  up: async (conn) => {
    const statements = [
      sql`ALTER TABLE cases ADD COLUMN case_code VARCHAR(8) NULL AFTER case_number`,
      sql`UPDATE cases SET case_code = UPPER(LEFT(MD5(CONCAT(guild_id, '-', id)), 7)) WHERE case_code IS NULL`,
      sql`ALTER TABLE cases MODIFY case_code VARCHAR(8) NOT NULL`,
      sql`ALTER TABLE cases ADD UNIQUE KEY uq_case_code (guild_id, case_code)`,
    ];
    for (const statement of statements) {
      await conn.query(statement);
    }
  },
};