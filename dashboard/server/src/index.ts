import * as path from 'path';
import * as fs from 'fs';
import express from 'express';
import { createServer } from 'http';
import { loadDashboardContext } from './context';
import { createAuthRouter } from './oauth';
import { requireAuth } from './auth';
import { createApiRouter } from './routes/logs';
import { createCasesRouter } from './routes/cases';
import { createConfigRouter } from './routes/config';
import { createMiscRouter } from './routes/misc';
import { createMessagesRouter } from './routes/messages';
import { createArchivesRouter } from './routes/archives';
import { createArchivePublicRouter } from './routes/archivePublic';
import { createMessageLogRouter } from './routes/messageLog';
import { createRoleConnectionsRouter } from './routes/roleConnections';
import { createAppealsRouter } from './routes/appeals';
import { createGdprRouter } from './routes/gdpr';
import { createExternalApiRouter } from './routes/external';
import { createEconomyRouter } from './routes/economy';
import { createWebSocketServer } from './ws';
import type { Request, Response, NextFunction } from 'express';
import { waitForDb, runMigrations, migrations } from '../../../shared/src/index';

// ---------------------------------------------------------------------------
// Request deadline middleware — guarantees every /api request gets a response
// within DEADLINE_MS, regardless of what happens inside route handlers (stuck
// DB pool, unhandled async throw, slow Discord API, etc.).
//
// Express 4 silently drops async rejections, leaving requests hanging until the
// client gives up.  Rather than chasing every code path with wrappers, this
// middleware arms a timer on every request.  If res.end() hasn't fired by the
// deadline, it logs the stall and sends a 504.
// ---------------------------------------------------------------------------
// Keep well below Cloudflare's 100 s proxy timeout so we always win the race.
const DEADLINE_MS = 12_000;

function requestDeadline(req: Request, res: Response, next: NextFunction): void {
  const timer = setTimeout(() => {
    if (res.headersSent) return;
    console.error(`[dashboard] TIMEOUT ${req.method} ${req.originalUrl} after ${DEADLINE_MS}ms`);
    res.status(504).json({ error: 'request_timed_out' });
  }, DEADLINE_MS);
  timer.unref?.();
  // Cancel the timer once the response is actually finished.
  res.on('finish', () => clearTimeout(timer));
  res.on('close', () => clearTimeout(timer));
  next();
}



function cookieMiddleware(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.cookie;
  const cookies: Record<string, string> = {};
  if (header) {
    for (const part of header.split(';')) {
      const idx = part.indexOf('=');
      if (idx > -1) {
        const key = part.slice(0, idx).trim();
        const value = part.slice(idx + 1).trim();
        cookies[key] = decodeURIComponent(value);
      }
    }
  }
  (req as unknown as { cookies: Record<string, string> }).cookies = cookies;
  next();
}

async function main(): Promise<void> {
  process.on('unhandledRejection', (reason) => {
    console.error('[dashboard] unhandled promise rejection:', reason);
  });

  const ctx = loadDashboardContext();
  try {
    await waitForDb(ctx.db, 90_000);
  } catch (err) {
    console.error('Database not reachable:', err);
    process.exit(1);
  }
  try {
    await runMigrations(ctx.db, migrations);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
  const app = express();
  app.use(express.json({ limit: '2mb' }));
  app.use(cookieMiddleware);

  // All /api and /oauth requests get a hard deadline.
  app.use('/api', requestDeadline);
  app.use('/oauth', requestDeadline);

  app.get('/api/health', (_req, res) => res.json({ ok: true }));
  app.use('/oauth', (req, _res, next) => {
    console.log(`[req] ${req.method} ${req.originalUrl} from ${req.ip}`);
    next();
  });
  app.use('/oauth', createAuthRouter(ctx));

  // Public archive share links + media (no auth required — the code is the key).
  app.use('/api/archive', createArchivePublicRouter(ctx));

  // Public appeals portal API (self-authenticated: session + membership + CSRF).
  app.use('/api/appeals', createAppealsRouter(ctx));

  // Public GDPR API (session-authenticated: any Discord user can manage their data).
  app.use('/api/gdpr', createGdprRouter(ctx));

  // External-bot API: API-key authenticated (Authorization: Bearer <key>).
  app.use('/api/v1', createExternalApiRouter(ctx));

  const protectedApi = express.Router();
  protectedApi.use(requireAuth(ctx));
  protectedApi.use('/logs', createApiRouter(ctx));
  protectedApi.use('/cases', createCasesRouter(ctx));
  protectedApi.use('/config', createConfigRouter(ctx));
  protectedApi.use('/messages', createMessagesRouter(ctx));
  protectedApi.use('/archives', createArchivesRouter(ctx));
  protectedApi.use('/message-log', createMessageLogRouter(ctx));
  protectedApi.use('/role-connections', createRoleConnectionsRouter(ctx));
  protectedApi.use('/economy', createEconomyRouter(ctx));
  protectedApi.use('/', createMiscRouter(ctx));
  app.use('/api', protectedApi);

  // Global error handler — catches errors passed via next(err).
  app.use((err: unknown, _req: Request, res: Response, next: NextFunction): void => {
    if (res.headersSent) { next(err); return; }
    console.error('[dashboard] unhandled error:', err);
    res.status(500).json({ error: 'internal_server_error' });
  });

  // Resolve the repo root by walking up to package.json — works from source (tsx),
  // compiled (dist-node), and inside Docker (/app).
  let root = __dirname;
  while (root !== path.dirname(root) && !fs.existsSync(path.join(root, 'package.json'))) {
    root = path.dirname(root);
  }
  const candidates = [
    path.resolve(root, 'dashboard/web/dist'),
    path.resolve(process.cwd(), 'dashboard/web/dist'),
  ];
  const webDist = candidates.find((c) => fs.existsSync(c)) || candidates[0];
  if (fs.existsSync(webDist)) {
    app.use(express.static(webDist));
    app.get(/^\/(?!api|oauth|ws).*/, (_req, res) => {
      res.sendFile(path.join(webDist, 'index.html'));
    });
  } else {
    app.get('/', (_req, res) =>
      res.send(
        `Dashboard frontend not built (looked in: ${candidates.join(' ; ')}). Run \`npm run dev:web\` for development, or rebuild the Docker image so \`npx vite build\` runs.`,
      ),
    );
  }

  const server = createServer(app);
  createWebSocketServer(server, ctx.db, ctx.sessionSecret);

  server.listen(ctx.port, () => {
    console.log(`Dashboard listening on http://localhost:${ctx.port}`);
  });
}

main().catch((err) => {
  console.error('Dashboard failed to start:', err);
  process.exit(1);
});
