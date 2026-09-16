import type { TextChannel } from 'discord.js';
import type { App } from '../core/context';

export interface CustomSlowmode {
  channelId: string;
  durationMs: number;
  createdAt: number;
  expiresAt: number | null;
  setBy: string;
}

export class CustomSlowmodeService {
  private readonly app: App;
  private readonly active = new Map<string, CustomSlowmode>();
  private readonly lastMessage = new Map<string, number>();
  private readonly expiryTimers = new Map<string, NodeJS.Timeout>();
  private readonly CLEANUP_INTERVAL = 60_000;

  constructor(app: App) {
    this.app = app;
    setInterval(() => this.cleanup(), this.CLEANUP_INTERVAL).unref?.();
  }

  public set(channelId: string, durationMs: number, setBy: string): CustomSlowmode {
    const now = Date.now();
    const existing = this.expiryTimers.get(channelId);
    if (existing) clearTimeout(existing);

    const slowmode: CustomSlowmode = {
      channelId,
      durationMs,
      createdAt: now,
      expiresAt: null,
      setBy,
    };
    this.active.set(channelId, slowmode);
    return slowmode;
  }

  public setWithExpiry(channelId: string, durationMs: number, expiresAt: number, setBy: string): CustomSlowmode {
    const slowmode = this.set(channelId, durationMs, setBy);
    slowmode.expiresAt = expiresAt;
    const delay = expiresAt - Date.now();
    if (delay > 0) {
      const timer = setTimeout(() => this.remove(channelId), delay);
      timer.unref?.();
      this.expiryTimers.set(channelId, timer);
    }
    return slowmode;
  }

  public remove(channelId: string): boolean {
    const timer = this.expiryTimers.get(channelId);
    if (timer) clearTimeout(timer);
    this.expiryTimers.delete(channelId);
    return this.active.delete(channelId);
  }

  public get(channelId: string): CustomSlowmode | null {
    return this.active.get(channelId) ?? null;
  }

  public shouldBlock(channelId: string, userId: string): boolean {
    const slowmode = this.active.get(channelId);
    if (!slowmode) return false;

    const key = `${channelId}:${userId}`;
    const last = this.lastMessage.get(key);
    if (last && Date.now() - last < slowmode.durationMs) return true;
    this.lastMessage.set(key, Date.now());
    return false;
  }

  public getRemainingMs(channelId: string, userId: string): number {
    const slowmode = this.active.get(channelId);
    if (!slowmode) return 0;
    const key = `${channelId}:${userId}`;
    const last = this.lastMessage.get(key);
    if (!last) return 0;
    const remaining = slowmode.durationMs - (Date.now() - last);
    return remaining > 0 ? remaining : 0;
  }

  public formatDuration(ms: number): string {
    const totalSeconds = Math.floor(ms / 1000);
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const parts: string[] = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    if (seconds > 0 && parts.length === 0) parts.push(`${seconds}s`);
    return parts.join(' ') || '0s';
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [channelId, slowmode] of this.active) {
      if (slowmode.expiresAt && now >= slowmode.expiresAt) {
        this.remove(channelId);
      }
    }
    for (const [key, timestamp] of this.lastMessage) {
      if (now - timestamp > 24 * 3600_000) this.lastMessage.delete(key);
    }
  }
}

const DISCORD_MAX_SLOWMODE = 21_600;

export function parseDuration(input: string): number | null {
  const trimmed = input.trim().toLowerCase();
  if (/^\d+$/.test(trimmed)) return parseInt(trimmed, 10) * 1000;

  let totalMs = 0;
  const regex = /(\d+)\s*(d|h|m|s|w)/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(trimmed)) !== null) {
    const value = parseInt(match[1], 10);
    switch (match[2]) {
      case 'w': totalMs += value * 7 * 86400_000; break;
      case 'd': totalMs += value * 86400_000; break;
      case 'h': totalMs += value * 3600_000; break;
      case 'm': totalMs += value * 60_000; break;
      case 's': totalMs += value * 1000; break;
    }
  }

  if (totalMs === 0) return null;
  return totalMs;
}

export function isNativeSlowmode(durationMs: number): boolean {
  return Math.floor(durationMs / 1000) <= DISCORD_MAX_SLOWMODE;
}
