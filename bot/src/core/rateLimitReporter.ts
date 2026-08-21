import type { App } from './context';
import type { RateLimitOrigin } from './logManager';

interface RequestRecord {
  route: string;
  stack: string;
}

const recentRequests: RequestRecord[] = [];
const MAX_RECORDED = 500;

/** Normalize a concrete API path into discord.js's route identifier form. */
function normalizePath(path: string): string {
  return path.replace(/\d+/g, ':id');
}

const FEATURE_DIRS: Record<string, string> = {
  commands: 'command',
  events: 'event',
  components: 'component',
  services: 'service',
  security: 'security',
  automod: 'automod',
  moderation: 'moderation',
  management: 'management',
  scheduler: 'scheduler',
  core: 'core',
  utils: 'util',
  reporting: 'reporting',
  metrics: 'metrics',
  client: 'client',
  community: 'community',
};

function featureFor(rel: string): string {
  const parts = rel.split('/');
  const name = parts[parts.length - 1].replace(/\.(ts|js|mjs|cjs)$/i, '');
  if (parts.length >= 3 && parts[parts.length - 3] === 'commands') return `command: ${name}`;
  if (parts.length >= 2) {
    const label = FEATURE_DIRS[parts[parts.length - 2]];
    if (label) return `${label}: ${name}`;
  }
  return name;
}

const STACK_FRAME_RE =
  /at(?: async)?\s+(?:[\w.$<>\[\]'" ]+?\s+)?\(?((?:file:\/\/\/)?(?:[A-Za-z]:)?[^():]+\.(?:ts|js|mjs|cjs)):(\d+):\d+\)?/;

/** Extract the first non-node_modules stack frame as { file, feature }. */
function describeStack(stack: string): RateLimitOrigin | null {
  for (const line of stack.split('\n')) {
    const m = STACK_FRAME_RE.exec(line);
    if (!m) continue;
    const raw = m[1];
    if (raw.includes('node_modules') || raw.includes('rateLimitReporter')) continue;
    const file = raw.replace(/^file:\/\/\//, '').replace(/\\/g, '/');
    const idx = file.lastIndexOf('/src/');
    const rel = idx >= 0 ? file.slice(idx + '/src/'.length) : (file.split('/').pop() ?? file);
    return { file: `${rel}:${m[2]}`, feature: featureFor(rel) };
  }
  return null;
}

/** Wrap rest.request so every outgoing API call records its origin stack. */
function captureRequestStacks(app: App): void {
  const rest = app.client.rest;
  const original = rest.request.bind(rest);
  rest.request = ((options: { method?: string; path?: string; route?: string }) => {
    const path = options.route ?? options.path ?? '';
    const route = normalizePath(path);
    recentRequests.push({ route, stack: new Error().stack ?? '' });
    if (recentRequests.length > MAX_RECORDED) recentRequests.splice(0, recentRequests.length - MAX_RECORDED);
    return original(options as never);
  }) as typeof rest.request;
}

/** Find the bot code that most recently hit the limited route. */
function findOrigin(route: string): RateLimitOrigin | null {
  const limited = normalizePath(route);
  for (let i = recentRequests.length - 1; i >= 0; i--) {
    if (recentRequests[i].route === limited) return describeStack(recentRequests[i].stack);
  }
  for (let i = recentRequests.length - 1; i >= 0; i--) {
    const rec = recentRequests[i];
    if (rec.route.startsWith(`${limited}/`) || limited.startsWith(`${rec.route}/`)) {
      return describeStack(rec.stack);
    }
  }
  if (recentRequests.length > 0) return describeStack(recentRequests[recentRequests.length - 1].stack);
  return null;
}

export function installRateLimitReporter(app: App): void {
  captureRequestStacks(app);

  app.client.on('rateLimit', (info) => {
    const route = info.route ?? info.path ?? 'unknown';
    void app.logManager.reportRateLimit({
      route,
      method: info.method ?? 'UNKNOWN',
      timeout: info.timeout ?? info.retryAfter ?? 0,
      global: info.global ?? false,
      bucket: info.bucket ?? null,
      origin: findOrigin(route),
    });
  });

  app.client.rest.on('rateLimited', (info) => {
    void app.logManager.reportRateLimit({
      route: info.route,
      method: info.method,
      timeout: info.retryAfter,
      global: info.global,
      origin: findOrigin(info.route),
    });
  });
}