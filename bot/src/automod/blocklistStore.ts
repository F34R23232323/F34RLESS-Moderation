import type { App } from '../core/context';

export type BlocklistCategory = 'nsfw' | 'malicious';
export type BlocklistModuleName = 'nsfw_link_blocklist' | 'malicious_link_blocklist';

export interface BlocklistSource {
  name: string;
  url: string;
  category: BlocklistCategory;
}

const FETCH_TIMEOUT_MS = 30_000;
const URL_RE = /https?:\/\/[^\s<>"']+/gi;
const DOMAIN_RE = /(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,63}/gi;
const DOMAIN_LIKE_RE = /^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z](?:[a-z0-9-]*[a-z0-9])?$/;

export function normalizeDomain(host: string): string {
  return host.trim().toLowerCase().replace(/^www\./, '').replace(/\.$/, '');
}

/**
 * Parse one line of a remote blocklist into a bare domain.
 * Handles hosts-file format ("0.0.0.0 example.com"), plain domain lists,
 * full URL lists, comments (#, !, //) and inline comments.
 */
export function parseBlocklistLine(rawLine: string): string | null {
  let line = rawLine.trim();
  if (!line) return null;
  if (line.startsWith('#') || line.startsWith('!') || line.startsWith('//')) return null;

  const hash = line.indexOf('#');
  if (hash !== -1) line = line.slice(0, hash).trim();
  if (!line) return null;

  const parts = line.split(/\s+/);
  if (parts.length >= 2 && /^[0-9a-f.:]+$/i.test(parts[0])) {
    line = parts[1];
  } else {
    line = parts[0];
  }

  if (/^https?:\/\//i.test(line)) {
    try {
      line = new URL(line).hostname;
    } catch {
      return null;
    }
  }

  line = line.split(/[/?#]/)[0];
  const colon = line.indexOf(':');
  if (colon !== -1) line = line.slice(0, colon);

  const domain = normalizeDomain(line);
  if (!DOMAIN_LIKE_RE.test(domain)) return null;
  // Skip hosts-file boilerplate (localhost, broadcasthost, ip6-* aliases).
  if (domain === 'localhost' || domain.endsWith('.local') || domain.endsWith('.localdomain') || domain.endsWith('.localhost')) return null;
  return domain;
}

/** Extract every distinct hostname referenced by a message (URLs and bare domains). */
export function extractHosts(content: string): string[] {
  const hosts = new Set<string>();
  let match: RegExpExecArray | null;

  const urlRe = new RegExp(URL_RE.source, 'gi');
  while ((match = urlRe.exec(content)) !== null) {
    try {
      const host = normalizeDomain(new URL(match[0]).hostname);
      if (host) hosts.add(host);
    } catch {
      // Malformed URL — skip.
    }
  }

  const domainRe = new RegExp(DOMAIN_RE.source, 'gi');
  while ((match = domainRe.exec(content)) !== null) {
    const host = normalizeDomain(match[0]);
    if (host) hosts.add(host);
  }

  return [...hosts];
}

/**
 * Look up a hostname (and all of its parent domains) in a blocklist map.
 * Returns the source name that listed the domain, or null.
 */
export function matchDomain(map: Map<string, string>, host: string): string | null {
  let candidate = normalizeDomain(host);
  while (candidate.includes('.')) {
    const source = map.get(candidate);
    if (source) return source;
    candidate = candidate.slice(candidate.indexOf('.') + 1);
  }
  return null;
}

export class BlocklistStore {
  private readonly maps: Record<BlocklistCategory, Map<string, string>> = {
    nsfw: new Map(),
    malicious: new Map(),
  };
  private refreshTimer: NodeJS.Timeout | null = null;
  private loading = false;

  constructor(private readonly app: App) {}

  public count(category: BlocklistCategory): number {
    return this.maps[category].size;
  }

  public match(category: BlocklistCategory, host: string): string | null {
    return matchDomain(this.maps[category], host);
  }

  private sourcesFor(moduleName: BlocklistModuleName, category: BlocklistCategory): BlocklistSource[] {
    const mod = this.app.config.automod.modules[moduleName];
    if (!mod.enabled || mod.sources.length === 0) return [];
    return mod.sources.map((s) => ({ name: s.name, url: s.url, category }));
  }

  private async fetchText(url: string): Promise<string> {
    const res = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS), redirect: 'follow' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  }

  /**
   * Fetch every configured source and rebuild the in-memory maps.
   * Never throws: failed sources are logged and previous data is retained.
   */
  public async load(): Promise<void> {
    if (this.loading) return;
    this.loading = true;
    try {
      const sources = [
        ...this.sourcesFor('nsfw_link_blocklist', 'nsfw'),
        ...this.sourcesFor('malicious_link_blocklist', 'malicious'),
      ];
      if (sources.length === 0) {
        this.app.logger.info('Blocklist store: no sources configured');
        return;
      }

      const results = await Promise.all(
        sources.map(async (source) => {
          try {
            return { source, text: await this.fetchText(source.url), error: null };
          } catch (err) {
            return { source, text: null, error: (err as Error).message };
          }
        }),
      );

      const next: Record<BlocklistCategory, Map<string, string>> = {
        nsfw: new Map(),
        malicious: new Map(),
      };
      const failedCategories = new Set<BlocklistCategory>();
      let anySuccess = false;

      for (const result of results) {
        if (result.text === null) {
          failedCategories.add(result.source.category);
          this.app.logger.warn(`Blocklist source "${result.source.name}" (${result.source.url}) failed: ${result.error}`);
          continue;
        }
        anySuccess = true;
        let parsed = 0;
        for (const line of result.text.split(/\r?\n/)) {
          const domain = parseBlocklistLine(line);
          if (domain) {
            next[result.source.category].set(domain, result.source.name);
            parsed += 1;
          }
        }
        this.app.logger.info(`Blocklist source "${result.source.name}": ${parsed} domains`);
      }

      if (!anySuccess) {
        this.app.logger.warn('Blocklist store: all sources failed — keeping previous data');
        return;
      }

      for (const category of ['nsfw', 'malicious'] as const) {
        // If any source in this category failed during a refresh, retain
        // previously loaded entries so a flaky source doesn't unblock them.
        if (failedCategories.has(category) && this.maps[category].size > 0) {
          for (const [domain, source] of this.maps[category]) {
            if (!next[category].has(domain)) next[category].set(domain, source);
          }
        }
        this.maps[category] = next[category];
      }

      this.app.logger.info(
        `Blocklist store loaded: ${this.maps.nsfw.size} nsfw domains, ${this.maps.malicious.size} malicious domains`,
      );
    } finally {
      this.loading = false;
    }
  }

  /** Refresh on the fastest configured per-module interval. */
  public startAutoRefresh(): void {
    if (this.refreshTimer) return;
    const nsfwCfg = this.app.config.automod.modules.nsfw_link_blocklist;
    const maliciousCfg = this.app.config.automod.modules.malicious_link_blocklist;
    const intervals: number[] = [];
    if (nsfwCfg.enabled && nsfwCfg.sources.length > 0) intervals.push(nsfwCfg.refresh_interval_hours);
    if (maliciousCfg.enabled && maliciousCfg.sources.length > 0) intervals.push(maliciousCfg.refresh_interval_hours);
    if (intervals.length === 0) return;

    this.refreshTimer = setInterval(() => {
      void this.load();
    }, Math.min(...intervals) * 3_600_000);
    this.refreshTimer.unref();
  }
}
