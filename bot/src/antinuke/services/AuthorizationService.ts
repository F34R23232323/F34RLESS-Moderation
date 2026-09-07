import type { Guild } from 'discord.js';
import type { Pool, RowDataPacket } from 'mysql2/promise';
import type { SecurityEventType, TrustDecision } from '../types/domain';

export class AuthorizationService {
  public constructor(private readonly db: Pool, private readonly botUserId: () => string | null) {}

  public async isRootOwner(guild: Guild, userId: string): Promise<boolean> {
    const currentGuild = await guild.fetch();
    return currentGuild.ownerId === userId;
  }

  public async isExtraOwner(guildId: string, userId: string): Promise<boolean> {
    const [rows] = await this.db.query<RowDataPacket[]>('SELECT 1 FROM antinuke_owners WHERE guild_id = ? AND user_id = ? AND revoked_at IS NULL LIMIT 1', [guildId, userId]);
    return rows.length === 1;
  }

  public async trustDecision(guild: Guild, userId: string, eventType: SecurityEventType): Promise<TrustDecision> {
    const currentGuild = await guild.fetch();
    if (currentGuild.ownerId === userId) return { trusted: true, reason: 'root_owner' };
    if (this.botUserId() === userId) return { trusted: true, reason: 'self' };
    if (await this.isExtraOwner(guild.id, userId)) return { trusted: true, reason: 'extra_owner' };
    const [rows] = await this.db.query<RowDataPacket[]>(
      `SELECT scopes_json, expires_at FROM antinuke_whitelist_entries
       WHERE guild_id = ? AND entity_type = 'user' AND entity_id = ? AND deleted_at IS NULL
       AND (expires_at IS NULL OR expires_at > NOW()) LIMIT 1`, [guild.id, userId],
    );
    const row = rows[0] as { scopes_json?: unknown } | undefined;
    if (!row) return { trusted: false, reason: 'not_trusted' };
    const scopes = typeof row.scopes_json === 'string' ? JSON.parse(row.scopes_json) as unknown : row.scopes_json;
    if (Array.isArray(scopes) && scopes.every((scope): scope is string => typeof scope === 'string') && (scopes.includes('*') || scopes.includes(eventType))) {
      return { trusted: true, reason: 'scoped_whitelist' };
    }
    return { trusted: false, reason: 'out_of_scope' };
  }
}
