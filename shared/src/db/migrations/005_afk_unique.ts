import type { Migration } from '../migrationRunner';

const sql = (strings: TemplateStringsArray): string => strings.join('');

export const migration005: Migration = {
  id: '005_afk_unique',
  up: async (conn) => {
    const statements = [
      sql`DELETE a FROM afk a JOIN afk b ON a.user_id = b.user_id AND a.guild_id = b.guild_id AND a.id < b.id`,
      sql`ALTER TABLE afk DROP KEY idx_afk_user`,
      sql`ALTER TABLE afk ADD UNIQUE KEY uq_afk_user (user_id, guild_id)`,
    ];
    for (const statement of statements) {
      await conn.query(statement);
    }
  },
};
