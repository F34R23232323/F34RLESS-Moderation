import type { ProtectionPolicy, SecurityEvent, ThresholdDecision } from '../types/domain';

export interface AtomicRedis {
  eval(script: string, numberOfKeys: number, ...args: Array<string | number>): Promise<unknown>;
}

const rollingWindowScript = `
local key = KEYS[1]
local dedupe = KEYS[2]
local now = tonumber(ARGV[1])
local window = tonumber(ARGV[2])
local eventId = ARGV[3]
local weight = tonumber(ARGV[4])
if redis.call('SET', dedupe, '1', 'PX', window, 'NX') == false then return {-1, -1} end
redis.call('ZREMRANGEBYSCORE', key, '-inf', now - window)
redis.call('ZADD', key, now, eventId .. ':' .. weight)
redis.call('PEXPIRE', key, window)
local members = redis.call('ZRANGE', key, 0, -1)
local weighted = 0
for _, member in ipairs(members) do
  local value = string.match(member, ':(%d+)$')
  weighted = weighted + tonumber(value)
end
return {#members, weighted}`;

export class ThresholdService {
  public constructor(private readonly redis: AtomicRedis | null) {}

  public async record(event: SecurityEvent, executorId: string, policy: ProtectionPolicy): Promise<ThresholdDecision> {
    if (!this.redis) return { crossed: false, count: 0, weightedCount: 0, limit: policy.countLimit, windowMs: policy.windowMs, reason: 'dependency_unavailable' };
    const base = `antinuke:${event.guildId}:${executorId}:${event.type}`;
    try {
      const result = await this.redis.eval(rollingWindowScript, 2, `${base}:events`, `${base}:dedupe:${event.eventId}`, event.observedAtMs, policy.windowMs, event.eventId, policy.eventWeight);
      if (!Array.isArray(result) || result.length !== 2) throw new Error('Invalid Redis rolling-window response');
      const count = Number(result[0]);
      const weightedCount = Number(result[1]);
      if (count === -1) return { crossed: false, count: 0, weightedCount: 0, limit: policy.countLimit, windowMs: policy.windowMs, reason: 'duplicate' };
      return { crossed: count >= policy.countLimit, count, weightedCount, limit: policy.countLimit, windowMs: policy.windowMs,
        reason: count >= policy.countLimit ? 'crossed' : 'below_threshold' };
    } catch (error) {
      const diagnostic = error instanceof Error ? error.message : 'Unknown Redis error';
      return { crossed: false, count: 0, weightedCount: 0, limit: policy.countLimit, windowMs: policy.windowMs, reason: 'dependency_unavailable', diagnostic };
    }
  }
}
