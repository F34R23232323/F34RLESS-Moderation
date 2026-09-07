import fc from 'fast-check';
import { expect, test } from 'vitest';
import { balancedAntiNukeConfig } from '../../../bot/src/antinuke/schemas/config';
import { evaluateFinalSafety } from '../../../bot/src/antinuke/policies/invariants';

test('unresolved identities never pass enforcement across randomized states', () => {
  fc.assert(fc.property(fc.boolean(), fc.boolean(), fc.boolean(), fc.boolean(), (database, redis, auditLog, warmup) => {
    const decision = evaluateFinalSafety({ config: { ...balancedAntiNukeConfig, enabled: true, setupCompletedAt: new Date(0).toISOString(), dryRun: false },
      attribution: { status: 'unresolved', reason: 'fuzz', candidates: [] }, trust: { trusted: false, reason: 'not_trusted' }, proposal: null,
      databaseAvailable: database, redisAvailable: redis, auditLogAvailable: auditLog, warmupComplete: warmup,
      incidentAlreadyHandled: false, currentGuildOwnerId: 'owner', botUserId: 'bot' });
    expect(decision.allowed).toBe(false);
  }), { numRuns: 5_000 });
});
