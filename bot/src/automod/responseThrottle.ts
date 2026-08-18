interface ThrottleEntry {
  lastSentAt: number;
  suppressedCount: number;
  userCount: Set<string>;
  timer: NodeJS.Timeout | null;
}

export interface ThrottleDecision {
  suppressSend: boolean;
  shouldSummarize: boolean;
}

export class ResponseThrottle {
  private readonly entries = new Map<string, ThrottleEntry>();

  public shouldSuppress(rule: string, channelId: string, userId: string, suppressSeconds: number, mode: 'silent' | 'batched_summary'): ThrottleDecision {
    if (suppressSeconds <= 0) return { suppressSend: false, shouldSummarize: false };
    const key = `${rule}:${channelId}`;
    const now = Date.now();
    const entry = this.entries.get(key);

    if (!entry || now - entry.lastSentAt >= suppressSeconds * 1000) {
      const next: ThrottleEntry = { lastSentAt: now, suppressedCount: 0, userCount: new Set(), timer: null };
      if (mode === 'batched_summary') {
        next.timer = setTimeout(() => {
          this.flush(rule, channelId);
        }, suppressSeconds * 1000);
        next.timer.unref?.();
      }
      this.entries.set(key, next);
      return { suppressSend: false, shouldSummarize: false };
    }

    entry.suppressedCount += 1;
    entry.userCount.add(userId);
    return { suppressSend: true, shouldSummarize: mode === 'batched_summary' };
  }

  public consumeSummary(rule: string, channelId: string): { count: number; users: number } | null {
    const entry = this.entries.get(`${rule}:${channelId}`);
    if (!entry || entry.suppressedCount === 0) return null;
    const result = { count: entry.suppressedCount, users: entry.userCount.size };
    entry.suppressedCount = 0;
    entry.userCount.clear();
    return result;
  }

  private flush(rule: string, channelId: string): void {
    const entry = this.entries.get(`${rule}:${channelId}`);
    if (entry) entry.timer = null;
  }
}