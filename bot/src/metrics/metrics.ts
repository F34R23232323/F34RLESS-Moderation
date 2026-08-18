import type { App } from '../core/context';

export interface MetricsSnapshot {
  messagesProcessed: number;
  messagesPerSecond: number;
  automodTriggersLastHour: number;
  commandsExecuted: number;
  commandsFailed: number;
  activeCooldowns: number;
  uptimeSeconds: number;
  memoryMB: number;
}

export class Metrics {
  private readonly app: App;
  private messagesProcessed = 0;
  private readonly automodTriggers: number[] = [];
  private commandsExecuted = 0;
  private commandsFailed = 0;
  private readonly startTime = Date.now();
  private readonly window = new Map<string, number[]>();

  constructor(app: App) {
    this.app = app;
  }

  public incMessages(): void {
    this.messagesProcessed++;
    this.push('messages', Date.now());
  }

  public incAutomodTrigger(): void {
    this.automodTriggers.push(Date.now());
  }

  public incCommand(success: boolean): void {
    this.commandsExecuted++;
    if (!success) this.commandsFailed++;
  }

  public snapshot(): MetricsSnapshot {
    const now = Date.now();
    const prune = (arr: number[], windowMs: number): number =>
      arr.filter((t) => now - t <= windowMs).length;

    const recentMsgs = this.window.get('messages') ?? [];
    const last60s = prune(recentMsgs, 60_000);
    const hourMsgs = prune(recentMsgs, 3_600_000);

    return {
      messagesProcessed: this.messagesProcessed,
      messagesPerSecond: Math.round(last60s / 60),
      automodTriggersLastHour: prune(this.automodTriggers, 3_600_000),
      commandsExecuted: this.commandsExecuted,
      commandsFailed: this.commandsFailed,
      activeCooldowns: this.app.cooldowns.size(),
      uptimeSeconds: Math.round((now - this.startTime) / 1000),
      memoryMB: Math.round(process.memoryUsage().rss / 1024 / 1024),
    };
  }

  public hourlyVolume(): number {
    return this.automodTriggers.filter((t) => Date.now() - t <= 3_600_000).length;
  }

  private push(key: string, ts: number): void {
    const arr = this.window.get(key) ?? [];
    arr.push(ts);
    if (arr.length > 10000) arr.splice(0, arr.length - 10000);
    this.window.set(key, arr);
  }
}