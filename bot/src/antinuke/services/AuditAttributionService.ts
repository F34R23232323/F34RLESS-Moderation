import { AuditLogEvent, type Guild, type GuildAuditLogsEntry } from 'discord.js';
import type { Pool, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import type { AntiNukeConfig } from '../schemas/config';
import { protectionRegistry } from '../policies/registry';
import type { AttributionResult, AuditEvidence, SecurityEvent } from '../types/domain';

export interface AuditSleeper { sleep(milliseconds: number): Promise<void> }

const defaultSleeper: AuditSleeper = { sleep: (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)) };

export class AuditAttributionService {
  public constructor(private readonly db: Pool, private readonly sleeper: AuditSleeper = defaultSleeper) {}

  public async attribute(guild: Guild, event: SecurityEvent, config: AntiNukeConfig): Promise<AttributionResult> {
    const definition = protectionRegistry.get(event.type);
    if (!definition || definition.auditActions.length === 0) return { status: 'unresolved', reason: 'no_audit_mapping', candidates: [] };

    const attempts = [0, ...config.auditRetryScheduleMs];
    for (const delay of attempts) {
      if (delay > 0) await this.sleeper.sleep(delay + Math.floor(Math.random() * Math.min(100, delay / 4)));
      const candidates = await this.fetchCandidates(guild, event, definition.auditActions, config.auditCorrelationWindowMs);
      if (candidates.length > 1) return { status: 'ambiguous', reason: 'multiple_matching_audit_entries', candidates };
      const evidence = candidates[0];
      if (!evidence) continue;
      const claimed = await this.claimEvidence(event, evidence);
      if (!claimed) return { status: 'unresolved', reason: 'audit_entry_already_processed', candidates: [evidence] };
      return { status: 'confirmed', executorId: evidence.executorId, confidence: 100, evidence };
    }
    return { status: 'unresolved', reason: 'no_matching_audit_entry_after_retries', candidates: [] };
  }

  private async fetchCandidates(guild: Guild, event: SecurityEvent, actions: readonly AuditLogEvent[], maxAgeMs: number): Promise<AuditEvidence[]> {
    const evidence: AuditEvidence[] = [];
    for (const action of actions) {
      const logs = await guild.fetchAuditLogs({ type: action, limit: 10 });
      for (const entry of logs.entries.values()) {
        const candidate = this.toEvidence(entry, event.observedAtMs);
        if (!candidate) continue;
        evidence.push(candidate);
      }
    }
    return selectMatchingEvidence(event, actions, evidence, maxAgeMs);
  }

  private toEvidence(entry: GuildAuditLogsEntry, observedAtMs: number): AuditEvidence | null {
    const executorId = entry.executorId;
    const targetId = entry.targetId;
    if (!executorId || !targetId) return null;
    const ageMs = Math.abs(observedAtMs - entry.createdTimestamp);
    return { auditEntryId: entry.id, action: entry.action, targetId, executorId, createdAtMs: entry.createdTimestamp,
      ageMs, authoritative: true, changes: entry.changes.map((change) => ({ key: change.key, old: change.old, new: change.new })) };
  }

  private async claimEvidence(event: SecurityEvent, evidence: AuditEvidence): Promise<boolean> {
    try {
      const [result] = await this.db.execute<ResultSetHeader>(
        'INSERT INTO antinuke_processed_audit_entries (guild_id, audit_entry_id, event_id, event_type) VALUES (?, ?, ?, ?)',
        [event.guildId, evidence.auditEntryId, event.eventId, event.type],
      );
      return result.affectedRows === 1;
    } catch (error) {
      const mysqlError = error as { code?: string };
      if (mysqlError.code === 'ER_DUP_ENTRY') return false;
      throw error;
    }
  }

  public async isProcessed(guildId: string, auditEntryId: string): Promise<boolean> {
    const [rows] = await this.db.query<RowDataPacket[]>('SELECT 1 FROM antinuke_processed_audit_entries WHERE guild_id = ? AND audit_entry_id = ? LIMIT 1', [guildId, auditEntryId]);
    return rows.length > 0;
  }
}

export function selectMatchingEvidence(event: SecurityEvent, expectedActions: readonly number[], candidates: readonly AuditEvidence[], maxAgeMs: number): AuditEvidence[] {
  return candidates.filter((candidate) => candidate.targetId === event.targetId && expectedActions.includes(candidate.action) &&
    candidate.ageMs <= maxAgeMs && candidate.authoritative)
    .filter((candidate, index, all) => all.findIndex((item) => item.auditEntryId === candidate.auditEntryId) === index);
}
