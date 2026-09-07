import type { Pool, RowDataPacket } from 'mysql2/promise';

export interface ConfigHistoryRecord extends RowDataPacket {
  version: number;
  actor_id: string;
  action: string;
  previous_json: unknown;
  next_json: unknown;
  created_at: Date;
}

export class ConfigHistoryService {
  public constructor(private readonly db: Pool) {}
  public async list(guildId: string, limit = 25): Promise<readonly ConfigHistoryRecord[]> {
    const safeLimit = Math.max(1, Math.min(100, Math.trunc(limit)));
    const [rows] = await this.db.query<ConfigHistoryRecord[]>(
      `SELECT version, actor_id, action, previous_json, next_json, created_at
       FROM antinuke_config_history WHERE guild_id = ? ORDER BY version DESC LIMIT ${safeLimit}`, [guildId]);
    return rows;
  }
}
