import { describe, expect, it } from 'vitest';
import { ThresholdService, type AtomicRedis } from '../../../bot/src/antinuke/services/ThresholdService';
import type { ProtectionPolicy, SecurityEvent } from '../../../bot/src/antinuke/types/domain';

const event: SecurityEvent = { eventId: 'event', guildId: 'guild', type: 'channel_delete', targetType: 'channel', targetId: 'target',
  observedAtMs: 1_000, shardId: 0, gatewaySequence: null, before: null, after: null };
const policy: ProtectionPolicy = { type: 'channel_delete', enabled: true, eventWeight: 10, countLimit: 3, windowMs: 10_000,
  warningThreshold: 1, quarantineThreshold: 3, kickThreshold: null, banThreshold: null, cooldownMs: 1_000,
  minimumConfidence: 100, defaultAction: 'quarantine', monitorOnly: false };

describe('rolling thresholds', () => {
  it('fails closed without Redis', async () => expect((await new ThresholdService(null).record(event, 'actor', policy)).reason).toBe('dependency_unavailable'));
  it('uses the exact configured boundary', async () => {
    const redis: AtomicRedis = { eval: async () => [3, 30] };
    expect((await new ThresholdService(redis).record(event, 'actor', policy)).crossed).toBe(true);
  });
  it('rejects duplicate gateway events', async () => {
    const redis: AtomicRedis = { eval: async () => [-1, -1] };
    expect((await new ThresholdService(redis).record(event, 'actor', policy)).reason).toBe('duplicate');
  });
});
