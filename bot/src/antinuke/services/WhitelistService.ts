import type { Pool, RowDataPacket } from 'mysql2/promise';
import type { SecurityEventType, WhitelistScope } from '../types/domain';

interface WhitelistRow extends RowDataPacket { guild_id: string; entity_type: WhitelistScope['entityType']; entity_id: string; scopes_json: unknown; expires_at: Date | null }

export class WhitelistService {
  public constructor(private readonly db: Pool) {}
  public async isAllowed(guildId: string, entityType: WhitelistScope['entityType'], entityId: string, action: SecurityEventType): Promise<boolean> {
    const [rows] = await this.db.query<WhitelistRow[]>(
      `SELECT guild_id, entity_type, entity_id, scopes_json, expires_at FROM antinuke_whitelist_entries
       WHERE guild_id = ? AND entity_type = ? AND entity_id = ? AND deleted_at IS NULL AND (expires_at IS NULL OR expires_at > NOW()) LIMIT 1`,
      [guildId, entityType, entityId],
    );
    const row = rows[0];
    if (!row) return false;
    const scopes = typeof row.scopes_json === 'string' ? JSON.parse(row.scopes_json) as unknown : row.scopes_json;
    return Array.isArray(scopes) && scopes.every((scope): scope is string => typeof scope === 'string') && (scopes.includes('*') || scopes.includes(action));
  }
}
