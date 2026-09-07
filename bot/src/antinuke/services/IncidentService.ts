import { randomUUID } from 'node:crypto';
import type { Pool } from 'mysql2/promise';
import type { AttributionResult, RiskDecision, SecurityEvent, ThresholdDecision } from '../types/domain';

export class IncidentService {
  public constructor(private readonly db: Pool, private readonly instanceId: string) {}

  public async recordEvent(event: SecurityEvent, attribution: AttributionResult, threshold: ThresholdDecision | null,
    risk: RiskDecision | null, configVersion: number, incidentId: string | null = null): Promise<string> {
    const correlationId = randomUUID();
    const executorId = attribution.status === 'confirmed' || attribution.status === 'trusted' ? attribution.executorId : null;
    const confidence = attribution.status === 'confirmed' || attribution.status === 'trusted' ? attribution.confidence : 0;
    const auditEntryId = attribution.status === 'confirmed' || attribution.status === 'trusted' ? attribution.evidence.auditEntryId : null;
    await this.db.execute(
      `INSERT INTO antinuke_incident_events (id, incident_id, guild_id, event_type, target_type, target_id, executor_id,
       attribution_status, confidence, audit_entry_id, observed_at, evidence_json, shard_id, instance_id, correlation_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [event.eventId, incidentId, event.guildId, event.type, event.targetType, event.targetId, executorId,
        attribution.status, confidence, auditEntryId, new Date(event.observedAtMs), JSON.stringify({ event, attribution, threshold, risk, configVersion }),
        event.shardId, this.instanceId, correlationId],
    );
    return correlationId;
  }

  public async open(event: SecurityEvent, executorId: string, risk: RiskDecision, configVersion: number, correlationId: string): Promise<string> {
    const id = randomUUID();
    await this.db.execute(
      `INSERT INTO antinuke_incidents (id, guild_id, executor_id, status, severity, risk_score, correlation_id, config_version, opened_at)
       VALUES (?, ?, ?, 'open', ?, ?, ?, ?, ?)`,
      [id, event.guildId, executorId, Math.min(100, risk.score), risk.score, correlationId, configVersion, new Date(event.observedAtMs)],
    );
    await this.db.execute('UPDATE antinuke_incident_events SET incident_id = ? WHERE guild_id = ? AND id = ?', [id, event.guildId, event.eventId]);
    return id;
  }
}
