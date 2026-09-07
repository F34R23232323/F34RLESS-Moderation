import { randomUUID } from 'node:crypto';
import type { AtomicRedis } from './ThresholdService';

const releaseScript = `if redis.call('GET', KEYS[1]) == ARGV[1] then return redis.call('DEL', KEYS[1]) else return 0 end`;

export interface LockRedis extends AtomicRedis { set(key: string, value: string, mode: 'PX', milliseconds: number, condition: 'NX'): Promise<'OK' | null> }

export class DistributedLockService {
  public constructor(private readonly redis: LockRedis | null) {}
  public async acquire(guildId: string, executorId: string, ttlMs = 15_000): Promise<{ release(): Promise<void> } | null> {
    if (!this.redis) return null;
    const key = `antinuke:lock:${guildId}:${executorId}`;
    const token = randomUUID();
    const acquired = await this.redis.set(key, token, 'PX', ttlMs, 'NX').catch(() => null);
    if (acquired !== 'OK') return null;
    return { release: async () => { await this.redis?.eval(releaseScript, 1, key, token); } };
  }
}
