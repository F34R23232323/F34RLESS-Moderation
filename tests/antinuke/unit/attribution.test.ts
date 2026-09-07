import { describe, expect, it } from 'vitest';
import { selectMatchingEvidence } from '../../../bot/src/antinuke/services/AuditAttributionService';
import type { AuditEvidence, SecurityEvent } from '../../../bot/src/antinuke/types/domain';

const event: SecurityEvent = { eventId: 'event', guildId: 'guild', type: 'channel_delete', targetType: 'channel',
  targetId: 'target', observedAtMs: 10_000, shardId: 0, gatewaySequence: null, before: null, after: null };
const evidence: AuditEvidence = { auditEntryId: 'audit', action: 12, targetId: 'target', executorId: 'executor',
  createdAtMs: 9_900, ageMs: 100, authoritative: true, changes: [] };

describe('audit correlation selection', () => {
  it('accepts one authoritative target/action/time match', () => expect(selectMatchingEvidence(event, [12], [evidence], 15_000)).toEqual([evidence]));
  it('rejects wrong target', () => expect(selectMatchingEvidence(event, [12], [{ ...evidence, targetId: 'other' }], 15_000)).toEqual([]));
  it('rejects wrong action', () => expect(selectMatchingEvidence(event, [13], [evidence], 15_000)).toEqual([]));
  it('rejects stale evidence', () => expect(selectMatchingEvidence(event, [12], [{ ...evidence, ageMs: 15_001 }], 15_000)).toEqual([]));
  it('deduplicates one audit entry', () => expect(selectMatchingEvidence(event, [12], [evidence, evidence], 15_000)).toEqual([evidence]));
  it('preserves distinct plausible entries so the caller marks ambiguity', () => expect(selectMatchingEvidence(event, [12], [evidence, { ...evidence, auditEntryId: 'other' }], 15_000)).toHaveLength(2));
});
