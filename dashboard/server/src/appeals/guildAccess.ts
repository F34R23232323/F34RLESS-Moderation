// ---------------------------------------------------------------------------
// Guild access + membership lookups for the appeals API.
//
// The dashboard runs as a separate process from the bot, so instead of
// trusting the (stale-able) OAuth `guilds` scope it verifies membership
// against Discord using the bot's own token — the bot is already in every
// guild it moderates, so `GET /guilds/:id/members/:userId` is authoritative.
// Results are cached briefly (60s) so repeated page loads don't hammer the
// API, mirroring the "cache briefly" requirement in the feature spec.
// ---------------------------------------------------------------------------

export interface GuildInfo {
  id: string;
  name: string;
  icon: string | null;
}

interface CacheEntry<T> {
  value: T;
  at: number;
}

const TTL_MS = 60_000;

export class GuildAccessService {
  private readonly token: string;
  private readonly members = new Map<string, CacheEntry<boolean>>();
  private readonly roles = new Map<string, CacheEntry<string[]>>();
  private readonly guilds = new Map<string, CacheEntry<GuildInfo | null>>();
  private guildListCache: CacheEntry<GuildInfo[]> | null = null;

  constructor(token: string) {
    this.token = token;
  }

  private async discordGet<T>(path: string): Promise<{ status: number; body: T | null }> {
    try {
      const res = await fetch(`https://discord.com/api/v10${path}`, {
        headers: { Authorization: `Bot ${this.token}` },
        signal: AbortSignal.timeout(7_000),
      });
      if (res.status === 429) {
        const retry = Number(res.headers.get('retry-after') ?? '1');
        // Cap the sleep at 2s so a single rate-limited request can't stall the
        // server for the full retry-after window (which can be up to 10s+).
        await new Promise((r) => setTimeout(r, Math.min(retry * 1000, 2000)));
      }
      if (res.status === 204) return { status: res.status, body: null };
      const body = (await res.json().catch(() => null)) as T | null;
      return { status: res.status, body };
    } catch {
      return { status: 0, body: null };
    }
  }

  /** Is the bot itself in this guild? */
  public async botInGuild(guildId: string): Promise<boolean> {
    const cached = this.guilds.get(guildId);
    if (cached && Date.now() - cached.at < TTL_MS) return cached.value !== null;
    const { status, body } = await this.discordGet<GuildInfo>(`/guilds/${guildId}`);
    const info = status === 200 && body ? body : null;
    this.guilds.set(guildId, { value: info, at: Date.now() });
    return info !== null;
  }

  /** Public guild info (name/icon) — used by the "not in this server" state. */
  public async guildInfo(guildId: string): Promise<GuildInfo | null> {
    await this.botInGuild(guildId);
    return this.guilds.get(guildId)?.value ?? null;
  }

  /** Is `userId` currently a member of `guildId`? (live check, 60s cache) */
  public async isMember(guildId: string, userId: string): Promise<boolean> {
    const key = `${guildId}:${userId}`;
    const cached = this.members.get(key);
    if (cached && Date.now() - cached.at < TTL_MS) return cached.value;
    const { status } = await this.discordGet<never>(`/guilds/${guildId}/members/${userId}`);
    const member = status === 200;
    // On network error (status 0) cache the negative for a short period so
    // we don't hammer a dead Discord endpoint on every concurrent request.
    const ttl = status === 0 ? 10_000 : TTL_MS;
    this.members.set(key, { value: member, at: Date.now() - (TTL_MS - ttl) });
    return member;
  }

  /** Role IDs of a member in a guild (empty if not a member / unavailable). */
  public async memberRoles(guildId: string, userId: string): Promise<string[]> {
    const key = `${guildId}:${userId}`;
    const cached = this.roles.get(key);
    if (cached && Date.now() - cached.at < TTL_MS) return cached.value;
    const { status, body } = await this.discordGet<{ roles: string[] }>(`/guilds/${guildId}/members/${userId}`);
    const roles = status === 200 ? (body?.roles ?? []) : [];
    const ttl = status === 0 ? 10_000 : TTL_MS;
    this.roles.set(key, { value: roles, at: Date.now() - (TTL_MS - ttl) });
    return roles;
  }

  /** All guilds the bot is in (owner/staff guild picker for the dashboard). */
  public async listGuilds(): Promise<GuildInfo[]> {
    if (this.guildListCache && Date.now() - this.guildListCache.at < TTL_MS) {
      return this.guildListCache.value;
    }
    const { status, body } = await this.discordGet<GuildInfo[]>('/users/@me/guilds');
    const list = status === 200 && Array.isArray(body) ? body : [];
    this.guildListCache = { value: list, at: Date.now() };
    return list;
  }
}
