export interface CachedMessage {
  content: string;
  authorId: string;
  channelId: string;
  guildId: string | null;
  attachmentCount: number;
  createdAt: number;
}

const TTL_MS = 24 * 3600_000;
const MAX_ENTRIES = 20_000;

export class MessageContentCache {
  private readonly store = new Map<string, CachedMessage>();

  public set(id: string, entry: CachedMessage): void {
    if (this.store.size >= MAX_ENTRIES) this.prune();
    this.store.set(id, entry);
  }

  public get(id: string): CachedMessage | null {
    const entry = this.store.get(id);
    if (!entry) return null;
    if (Date.now() - entry.createdAt > TTL_MS) {
      this.store.delete(id);
      return null;
    }
    return entry;
  }

  public delete(id: string): void {
    this.store.delete(id);
  }

  public prune(): void {
    const cutoff = Date.now() - TTL_MS;
    for (const [key, entry] of this.store) {
      if (entry.createdAt < cutoff) this.store.delete(key);
    }
  }
}
