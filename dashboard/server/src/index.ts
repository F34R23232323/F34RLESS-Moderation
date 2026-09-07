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
import { waitForDb, runMigrations, migrations } from '../../../shared/src/index';

function cookieMiddleware(req: express.Request, _res: express.Response, next: express.NextFunction): void {
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