import { describe, expect, it } from 'vitest';
import { balancedAntiNukeConfig } from '../../../bot/src/antinuke/schemas/config';
import { ExternalAppSecurityService } from '../../../bot/src/antinuke/services/ExternalAppSecurityService';

const service = new ExternalAppSecurityService();
const unresolved = { status: 'unresolved', reason: 'no audit entry', candidates: [] } as const;

describe('external app false-positive prevention', () => {
  it.each(['slash command', 'bot mention', 'webhook message', 'message proximity', 'unknown inviter', 'modified client suspicion'])(
    'does not quarantine a human for %s', () => {
      const decision = service.decide({ humanAttribution: unresolved, approved: false, withinApprovedScope: false,
        prohibitedRuleMatched: true, entityIsSystemManaged: false }, balancedAntiNukeConfig);
      expect(decision.quarantineHuman).toBe(false);
      expect(decision.classification).toBe('attribution_unavailable');
    });
  it('keeps review quarantine disabled by default', () => {
    const decision = service.decide({ humanAttribution: { status: 'confirmed', executorId: '100000000000000001', confidence: 100,
      evidence: { auditEntryId: '100000000000000002', action: 1, targetId: '100000000000000003', executorId: '100000000000000001', createdAtMs: 1, ageMs: 0, authoritative: true, changes: [] } },
      approved: false, withinApprovedScope: false, prohibitedRuleMatched: true, entityIsSystemManaged: false }, balancedAntiNukeConfig);
    expect(decision.quarantineHuman).toBe(false);
  });
});
