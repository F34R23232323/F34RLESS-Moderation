import { AuditLogEvent, type Guild, type GuildAuditLogsEntry } from 'discord.js';
import type { App } from '../core/context';

interface CachedEntry {
  entry: GuildAuditLogsEntry;
  seenAt: number;
}

/** How long a buffered audit entry is kept before it is pruned. */
const BUFFER_TTL_MS = 15_000;
/** Max entries kept per (guild, action) pair. */
const MAX_PER_TYPE = 20;
/** Events older than this are never attributed to an actor (avoids
 *  misattributing an unrelated earlier action of the same type). */
const DEFAULT_WINDOW_MS = 8_000;

const buffer = new Map<string, Map<AuditLogEvent, CachedEntry[]>>();

/**
 * Store a fresh audit log entry pushed by the guildAuditLogEntryCreate
 * gateway event. Events can then attribute the executor without an extra
 * API call; fetchAuditLogs is only used as a fallback (e.g. entries that
 * happened before the buffer was seeded, or guilds where the gateway event
 * is unavailable).
 */
export function rememberAuditEntry(guildId: string, entry: GuildAuditLogsEntry): void {
  const byType = buffer.get(guildId) ?? new Map<AuditLogEvent, CachedEntry[]>();
  const list = byType.get(entry.action) ?? [];
  list.push({ entry, seenAt: Date.now() });
  if (list.length > MAX_PER_TYPE) list.shift();
  byType.set(entry.action, list);
  buffer.set(guildId, byType);
}

function prune(guildId: string): void {
  const byType = buffer.get(guildId);
  if (!byType) return;
  const now = Date.now();
  for (const [type, list] of byType) {
    const alive = list.filter((c) => now - c.seenAt <= BUFFER_TTL_MS);
    if (alive.length === 0) byType.delete(type);
    else byType.set(type, alive);
  }
  if (byType.size === 0) buffer.delete(guildId);
}

export interface ResolveAuditActorOptions {
  /** Require the audit entry's target to equal this ID (channel, role, member, message, ...). */
  targetId?: string | null;
  /** Additional predicate over the raw entry (e.g. invite code matching). */
  match?: (entry: GuildAuditLogsEntry) => boolean;
  /** Only attribute entries newer than this many ms. Default 8000. */
  windowMs?: number;
  /** How many entries to fetch on the API fallback. Default 5. */
  limit?: number;
  /** Extra resolution attempts after the first (audit entries can arrive a
   *  moment after the gateway event that triggered them). Default 0. */
  retries?: number;
  /** Delay between retries in ms. Default 1500. */
  retryDelayMs?: number;
}

/**
 * Resolve who performed an action of the given audit log type, using the
 * real-time gateway buffer first and fetchAuditLogs as fallback. Returns the
 * executor ID or null when no matching entry exists (e.g. self-service
 * actions that Discord does not audit-log).
 */
export async function resolveAuditActor(
  app: App,
  guild: Guild,
  type: AuditLogEvent,
  opts: ResolveAuditActorOptions = {},
): Promise<string | null> {
  const attempts = opts.retries ?? 0;
  for (let attempt = 0; attempt <= attempts; attempt++) {
    if (attempt > 0) {
      await new Promise((resolve) => setTimeout(resolve, opts.retryDelayMs ?? 1500));
    }
    const actor = await resolveAuditActorOnce(app, guild, type, opts);
    if (actor) return actor;
  }
  return null;
}

async function resolveAuditActorOnce(
  app: App,
  guild: Guild,
  type: AuditLogEvent,
  opts: ResolveAuditActorOptions = {},
): Promise<string | null> {
  const windowMs = opts.windowMs ?? DEFAULT_WINDOW_MS;
  const matches = (entry: GuildAuditLogsEntry): boolean => {
    if (opts.targetId && entry.targetId !== opts.targetId) return false;
    if (opts.match && !opts.match(entry)) return false;
    return true;
  };

  prune(guild.id);
  const cached = buffer.get(guild.id)?.get(type) ?? [];
  for (let i = cached.length - 1; i >= 0; i--) {
    const { entry } = cached[i];
    if (Date.now() - entry.createdTimestamp > windowMs) continue;
    if (matches(entry)) return entry.executorId ?? null;
  }

  try {
    const logs = await guild.fetchAuditLogs({ type, limit: opts.limit ?? 5 });
    const now = Date.now();
    for (const entry of logs.entries.values()) {
      if (now - entry.createdTimestamp > windowMs) continue;
      if (matches(entry)) return entry.executorId ?? null;
    }
  } catch (err) {
    app.logger.debug(`audit lookup failed for ${AuditLogEvent[type]}: ${(err as Error).message}`);
  }
  return null;
}