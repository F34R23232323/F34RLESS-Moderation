export class CooldownManager {
  private readonly store = new Map<string, number>();
  private readonly ttlMs: number;

  constructor(ttlMs = 86_400_000) {
    this.ttlMs = ttlMs;
  }

  private key(scope: string, id: string, bucket: string): string {
    return `${scope}:${id}:${bucket}`;
  }

  public tryConsume(scope: string, id: string, bucket: string, seconds: number): boolean {
    if (seconds <= 0) return true;
    const k = this.key(scope, id, bucket);
    const now = Date.now();
    const expires = this.store.get(k) ?? 0;
    if (expires > now) return false;
    this.store.set(k, now + seconds * 1000);
    this.prune(now);
    return true;
  }

  public remainingSeconds(scope: string, id: string, bucket: string): number {
    const k = this.key(scope, id, bucket);
    const expires = this.store.get(k) ?? 0;
    return Math.max(0, Math.ceil((expires - Date.now()) / 1000));
  }

  public clear(scope: string, id: string, bucket: string): void {
    this.store.delete(this.key(scope, id, bucket));
  }

  public size(): number {
    return this.store.size;
  }

  private prune(now: number): void {
    if (this.store.size < 5000) return;
    for (const [k, exp] of this.store) {
      if (exp <= now) this.store.delete(k);
    }
  }
}