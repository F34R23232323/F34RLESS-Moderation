import { randomUUID } from 'node:crypto';
import type { Pool } from 'mysql2/promise';

export class AntiNukeLogger {
  public constructor(private readonly db: Pool) {}
  public async queue(guildId: string, kind: string, destinationId: string | null, caseId: string | null, incidentId: string | null, escalationLevel = 0): Promise<boolean> {
    try {
      await this.db.execute(`INSERT INTO antinuke_notifications
        (id, guild_id, incident_id, case_id, notification_kind, escalation_level, status, destination_id)
        VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)`, [randomUUID(), guildId, incidentId, caseId, kind, escalationLevel, destinationId]);
      return true;
    } catch (error) {
      if ((error as { code?: string }).code === 'ER_DUP_ENTRY') return false;
      throw error;
    }
  }
}
