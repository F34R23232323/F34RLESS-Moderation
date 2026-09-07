import type { Pool, RowDataPacket } from 'mysql2/promise';
import type { MaintenanceScope, SecurityEvent } from '../types/domain';

interface SessionRow extends RowDataPacket { owner_id: string; scopes_json: unknown; expires_at: Date }

export class MaintenanceService {
  public constructor(private readonly db: Pool) {}
  public async authorizes(event: SecurityEvent, executorId: string): Promise<boolean> {
    const [rows] = await this.db.query<SessionRow[]>(
      `SELECT owner_id, scopes_json, expires_at FROM antinuke_maintenance_sessions
       WHERE guild_id = ? AND stopped_at IS NULL AND starts_at <= NOW() AND expires_at > NOW()`, [event.guildId]);
    return rows.some((row) => {
      const raw = typeof row.scopes_json === 'string' ? JSON.parse(row.scopes_json) as unknown : row.scopes_json;
      if (!isMaintenanceScope(raw)) return false;
      return (raw.users.includes(executorId) || raw.users.includes('*')) && (raw.actions.includes(event.type) || raw.actions.includes('*' as SecurityEvent['type'])) &&
        (raw.channels.length === 0 || raw.channels.includes(event.targetId) || raw.channels.includes('*'));
    });
  }
}

function isMaintenanceScope(value: unknown): value is MaintenanceScope {
  if (!value || typeof value !== 'object') return false;
  const scope = value as Record<string, unknown>;
  return ['users', 'roles', 'channels', 'apps', 'actions'].every((key) => Array.isArray(scope[key]) && (scope[key] as unknown[]).every((item) => typeof item === 'string'));
}
