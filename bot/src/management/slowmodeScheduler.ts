import type { TextChannel } from 'discord.js';
import type { App } from '../core/context';
import { MessageTracker } from '../automod/tracker';

export class SlowmodeScheduler {
  private readonly app: App;
  private readonly tracker = new MessageTracker();
  private readonly reverted = new Map<string, NodeJS.Timeout>();

  constructor(app: App) {
    this.app = app;
  }

  public onMessage(channelId: string): void {
    if (!this.app.config.slowmode_scheduler.enabled) return;
    this.tracker.push(`slow:${channelId}`);
    const cfg = this.app.config.slowmode_scheduler;
    const count = this.tracker.countInWindow(`slow:${channelId}`, 60_000);
    if (count >= cfg.threshold_messages_per_minute) {
      void this.applySlowmode(channelId, cfg.slowmode_seconds);
    }
  }

  private async applySlowmode(channelId: string, slowmodeSeconds: number): Promise<void> {
    const channel = this.app.client.channels.cache.get(channelId) as TextChannel | undefined;
    if (!channel || channel.rateLimitPerUser >= slowmodeSeconds) return;
    await channel.setRateLimitPerUser(slowmodeSeconds, 'Auto slowmode').catch(() => undefined);

    const existing = this.reverted.get(channelId);
    if (existing) clearTimeout(existing);
    const cfg = this.app.config.slowmode_scheduler;
    const timer = setTimeout(() => {
      void this.revert(channelId);
    }, cfg.revert_after_minutes * 60_000);
    timer.unref?.();
    this.reverted.set(channelId, timer);
  }

  private async revert(channelId: string): Promise<void> {
    this.reverted.delete(channelId);
    const channel = this.app.client.channels.cache.get(channelId) as TextChannel | undefined;
    if (!channel) return;
    await channel.setRateLimitPerUser(0, 'Auto slowmode revert').catch(() => undefined);
  }

  public revertLoop(): void {
    setInterval(() => {
      const now = Date.now();
      for (const [id, entry] of this.entries()) {
        void entry;
        this.tracker.countInWindow(`slow:${id}`, 60_000, now);
      }
    }, 60_000).unref?.();
  }

  private *entries(): Generator<[string, number]> {
    for (const [key] of this.reverted) {
      yield [key, 0];
    }
  }
}