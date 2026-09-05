interface RecentDm {
  at: number;
  priority: number;
  key: string;
}

export class NotificationDmGuard {
  private readonly recent = new Map<string, RecentDm>();

  public allow(userId: string, key: string, priority: number, cooldownSeconds: number): boolean {
    const now = Date.now();
    const previous = this.recent.get(userId);
    const cooldownMs = cooldownSeconds * 1000;

    if (previous && now - previous.at < cooldownMs) {
      if (previous.key === key || priority <= previous.priority) return false;
    }

    this.recent.set(userId, { at: now, priority, key });
    this.prune(now, cooldownMs);
    return true;
  }

  public release(userId: string, key: string): void {
    if (this.recent.get(userId)?.key === key) this.recent.delete(userId);
  }

  private prune(now: number, cooldownMs: number): void {
    if (this.recent.size < 2000) return;
    for (const [userId, entry] of this.recent) {
      if (now - entry.at > Math.max(cooldownMs * 2, 60_000)) this.recent.delete(userId);
    }
  }
}

export const notificationDmGuard = new NotificationDmGuard();
