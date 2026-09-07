import { describe, expect, it } from 'vitest';
import { DistributedLockService, type LockRedis } from '../../../bot/src/antinuke/services/DistributedLockService';

describe('distributed incident lock', () => {
  it('allows one holder and releases only through the token script', async () => {
    let held = false;
    let releases = 0;
    const redis: LockRedis = {
      set: async () => { if (held) return null; held = true; return 'OK'; },
      eval: async () => { held = false; releases += 1; return 1; },
    };
    const service = new DistributedLockService(redis);
    const first = await service.acquire('guild', 'executor');
    expect(first).not.toBeNull();
    expect(await service.acquire('guild', 'executor')).toBeNull();
    await first?.release();
    expect(releases).toBe(1);
    expect(await service.acquire('guild', 'executor')).not.toBeNull();
  });
  it('fails closed when Redis is unavailable', async () => expect(await new DistributedLockService(null).acquire('guild', 'executor')).toBeNull());
});
