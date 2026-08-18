export interface TrackerEntry {
  ts: number;
  id?: string;
}

export class MessageTracker {
  private readonly store = new Map<string, TrackerEntry[]>();
  private readonly limit = 200;

  public push(key: string, timestamp: number = Date.now(), id?: string): number {
    const arr = this.store.get(key) ?? [];
    arr.push({ ts: timestamp, id });
    const cutoff = timestamp - 3600_000;
    const filtered = arr.filter((e) => e.ts >= cutoff);
    if (filtered.length > this.limit) filtered.splice(0, filtered.length - this.limit);
    this.store.set(key, filtered);
    return filtered.length;
  }

  public countInWindow(key: string, windowMs: number, now: number = Date.now()): number {
    const arr = this.store.get(key) ?? [];
    const cutoff = now - windowMs;
    return arr.filter((e) => e.ts >= cutoff).length;
  }

  public timestampsInWindow(key: string, windowMs: number, now: number = Date.now()): number[] {
    return this.entriesInWindow(key, windowMs, now).map((e) => e.ts);
  }

  public entriesInWindow(key: string, windowMs: number, now: number = Date.now()): TrackerEntry[] {
    const arr = this.store.get(key) ?? [];
    const cutoff = now - windowMs;
    return arr.filter((e) => e.ts >= cutoff);
  }

  public clear(key: string): void {
    this.store.delete(key);
  }
}
