import { randomUUID } from 'node:crypto';
import type { Pool, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import type { ExternalAppCaseStatus } from '../types/domain';

const transitions: Readonly<Record<ExternalAppCaseStatus, readonly ExternalAppCaseStatus[]>> = {
  observed: ['awaiting_evidence', 'alert_only', 'quarantined_pending_review', 'closed'], awaiting_evidence: ['alert_only', 'quarantined_pending_review', 'closed'],
  alert_only: ['quarantined_pending_review', 'false_positive', 'closed'], quarantined_pending_review: ['confirmed_keep_quarantined', 'released', 'false_positive', 'appealed', 'enforcement_failed'],
  confirmed_keep_quarantined: ['released', 'false_positive', 'appealed', 'closed'], released: ['closed'], false_positive: ['closed'],
  expired_auto_released: ['closed'], enforcement_failed: ['released', 'closed'], appealed: ['confirmed_keep_quarantined', 'released', 'false_positive'], closed: [],
};

interface CaseRow extends RowDataPacket { status: ExternalAppCaseStatus; evidence_version: number }

export class ExternalAppCaseService {
  public constructor(private readonly db: Pool) {}
  public async transition(caseId: string, guildId: string, actorId: string, expected: ExternalAppCaseStatus, next: ExternalAppCaseStatus, reason: string): Promise<void> {
    if (!transitions[expected].includes(next)) throw new Error(`Invalid case transition ${expected} -> ${next}`);
    const connection = await this.db.getConnection();
    try {
      await connection.beginTransaction();
      const [rows] = await connection.query<CaseRow[]>('SELECT status, evidence_version FROM antinuke_external_app_cases WHERE id = ? AND guild_id = ? FOR UPDATE', [caseId, guildId]);
      const current = rows[0];
      if (!current || current.status !== expected) throw new Error('Case changed or does not exist');
      const [result] = await connection.execute<ResultSetHeader>('UPDATE antinuke_external_app_cases SET status = ?, reviewer_id = ?, review_reason = ?, evidence_version = evidence_version + 1 WHERE id = ? AND status = ?',
        [next, actorId, reason.slice(0, 1000), caseId, expected]);
      if (result.affectedRows !== 1) throw new Error('Concurrent case decision rejected');
      await connection.execute('INSERT INTO antinuke_case_transitions (case_id, guild_id, actor_id, previous_status, next_status, reason, evidence_version) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [caseId, guildId, actorId, expected, next, reason.slice(0, 1000), current.evidence_version + 1]);
      await connection.commit();
    } catch (error) { await connection.rollback(); throw error; } finally { connection.release(); }
  }
  public newId(): string { return randomUUID(); }
}
