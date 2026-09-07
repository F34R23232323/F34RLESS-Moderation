import { describe, expect, it } from 'vitest';
import { balancedAntiNukeConfig } from '../../../bot/src/antinuke/schemas/config';
import { evaluateFinalSafety, type FinalSafetyContext } from '../../../bot/src/antinuke/policies/invariants';
import type { AuditEvidence, ProposedEnforcement } from '../../../bot/src/antinuke/types/domain';

const evidence: AuditEvidence = { auditEntryId: '100000000000000001', action: 10, targetId: '100000000000000002',
  executorId: '100000000000000003', createdAtMs: 10_000, ageMs: 100, authoritative: true, changes: [] };
const proposal: ProposedEnforcement = { action: 'quarantine', executorId: evidence.executorId, reason: 'threshold', evidence,
  threshold: { crossed: true, count: 3, weightedCount: 30, limit: 3, windowMs: 10_000, reason: 'crossed' },
  risk: { score: 30, threshold: 30, crossed: true, contributors: ['channel_delete'] } };
const base: FinalSafetyContext = { config: { ...balancedAntiNukeConfig, enabled: true, setupCompletedAt: new Date(0).toISOString(), dryRun: false },
  attribution: { status: 'confirmed', executorId: evidence.executorId, confidence: 100, evidence }, trust: { trusted: false, reason: 'not_trusted' },
  proposal, databaseAvailable: true, redisAvailable: true, auditLogAvailable: true, warmupComplete: true,
  incidentAlreadyHandled: false, currentGuildOwnerId: '100000000000000004', botUserId: '100000000000000005' };

describe('final safety gate', () => {
  it('allows only a complete confirmed proposal', () => expect(evaluateFinalSafety(base).allowed).toBe(true));
  it.each([
    ['missing attribution', { attribution: { status: 'unresolved', reason: 'missing', candidates: [] } }],
    ['ambiguous attribution', { attribution: { status: 'ambiguous', reason: 'multiple', candidates: [evidence] } }],
    ['owner', { currentGuildOwnerId: evidence.executorId }], ['bot', { botUserId: evidence.executorId }],
    ['trusted', { trust: { trusted: true, reason: 'extra_owner' } }], ['database outage', { databaseAvailable: false }],
    ['redis outage', { redisAvailable: false }], ['audit outage', { auditLogAvailable: false }],
    ['warmup', { warmupComplete: false }], ['duplicate incident', { incidentAlreadyHandled: true }],
    ['below threshold', { proposal: { ...proposal, threshold: { ...proposal.threshold, crossed: false } } }],
    ['dry run', { config: { ...base.config, dryRun: true } }],
  ] as const)('suppresses %s', (_name, override) => expect(evaluateFinalSafety({ ...base, ...override } as FinalSafetyContext).allowed).toBe(false));
  it('never enables ban implicitly', () => expect(evaluateFinalSafety({ ...base, proposal: { ...proposal, action: 'ban' } }).allowed).toBe(false));
});
