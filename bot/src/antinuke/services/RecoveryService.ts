import { randomUUID } from 'node:crypto';
import type { Pool, RowDataPacket } from 'mysql2/promise';
import type { RecoveryPlan, TargetType } from '../types/domain';

interface SnapshotRow extends RowDataPacket { id: string; resource_type: TargetType }
export class RecoveryService {
  public constructor(private readonly db: Pool) {}
  public async preview(guildId: string, incidentId: string): Promise<RecoveryPlan> {
    const [rows] = await this.db.query<SnapshotRow[]>('SELECT id, resource_type FROM antinuke_resource_snapshots WHERE guild_id = ? AND incident_id = ? ORDER BY created_at', [guildId, incidentId]);
    const priority: Readonly<Record<string, number>> = { role: 0, channel: 1, thread: 2 };
    const items = [...rows].sort((left, right) => (priority[left.resource_type] ?? 9) - (priority[right.resource_type] ?? 9))
      .map((row) => ({ snapshotId: row.id, resourceType: row.resource_type, operation: 'restore' as const, reason: 'Preview only; collision and dangerous-permission checks required before execution' }));
    return { id: randomUUID(), guildId, incidentId, dryRun: true, items };
  }
}
