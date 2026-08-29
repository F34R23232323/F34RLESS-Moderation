import type { Migration } from '../migrationRunner';

const sql = (strings: TemplateStringsArray): string => strings.join('');

/**
 * Mutes longer than Discord's 28-day timeout cap are applied in 28-day chunks
 * and re-applied automatically until the full duration has elapsed. The
 * `renewable` flag marks those punishments so the scheduler knows to renew.
 */
export const migration016: Migration = {
  id: '016_mute_renewals',
  up: async (conn) => {
    const statements = [
      sql`ALTER TABLE punishments
          ADD COLUMN renewable TINYINT(1) NOT NULL DEFAULT 0 AFTER case_id`,
      sql`ALTER TABLE punishments
          ADD KEY idx_punishments_renewable (renewable, active, expires_at)`,
    ];

    for (const statement of statements) {
      await conn.query(statement);
    }
  },
};