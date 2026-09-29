import type { Pool, RowDataPacket } from 'mysql2/promise';

export type WhitelistScope = 'automod' | 'moderation' | 'raid' | 'blacklist' | 'verification' | 'escalation' | 'reply_ping' | 'voice' | 'slowmode' | 'api' | 'nick_lock' | 'all';

export const WHITELIST_SCOPES: WhitelistScope[] = ['automod', 'moderation', 'raid', 'blacklist', 'verification', 'escalation', 'reply_ping', 'voice', 'slowmode', 'api', 'nick_lock', 'all'];

export interface WhitelistEntry {
  id: number;
  guild_id: string;
  user_id: string;
  scope: WhitelistScope;
  reason: string | null;
  added_by: string;
  added_at: string;
}

export class WhitelistService {
  private readonly db: Pool;

  constructor(db: Pool) {
    this.db = db;
  }

  public async isWhitelisted(guildId: string, userId: string, scope: WhitelistScope): Promise<boolean> {
    const [rows] = await this.db.query<RowDataPacket[]>(
      `SELECT 1 FROM user_whitelist
       WHERE guild_id = ? AND user_id = ? AND (scope = ? OR scope = 'all')
       LIMIT 1`,
      [guildId, userId, scope],
    );
    return rows.length > 0;
  }

  public async isWhitelistedFromAny(guildId: string, userId: string): Promise<boolean> {
    const [rows] = await this.db.query<RowDataPacket[]>(
      `SELECT 1 FROM user_whitelist
       WHERE guild_id = ? AND user_id = ?
       LIMIT 1`,
      [guildId, userId],
    );
    return rows.length > 0;
  }

  public async add(guildId: string, userId: string, scope: WhitelistScope, addedBy: string, reason?: string): Promise<void> {
    await this.db.execute(
      `INSERT INTO user_whitelist (guild_id, user_id, scope, reason, added_by)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE reason = VALUES(reason), added_by = VALUES(added_by), added_at = CURRENT_TIMESTAMP`,
      [guildId, userId, scope, reason ?? null, addedBy],
    );
  }

  public async remove(guildId: string, userId: string, scope?: WhitelistScope): Promise<number> {
    if (scope) {
      const [result] = await this.db.execute(
        'DELETE FROM user_whitelist WHERE guild_id = ? AND user_id = ? AND scope = ?',
        [guildId, userId, scope],
      );
      return (result as any).affectedRows as number;
    }
    const [result] = await this.db.execute(
      'DELETE FROM user_whitelist WHERE guild_id = ? AND user_id = ?',
      [guildId, userId],
    );
    return (result as any).affectedRows as number;
  }

  public async list(guildId: string): Promise<WhitelistEntry[]> {
    const [rows] = await this.db.query<RowDataPacket[]>(
      `SELECT * FROM user_whitelist WHERE guild_id = ? ORDER BY added_at DESC`,
      [guildId],
    );
    return rows as WhitelistEntry[];
  }

  public async getByUser(guildId: string, userId: string): Promise<WhitelistEntry[]> {
    const [rows] = await this.db.query<RowDataPacket[]>(
      `SELECT * FROM user_whitelist WHERE guild_id = ? AND user_id = ?`,
      [guildId, userId],
    );
    return rows as WhitelistEntry[];
  }
}
