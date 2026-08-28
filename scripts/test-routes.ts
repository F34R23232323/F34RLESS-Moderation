import * as http from 'http';
import express from 'express';
import { createApiRouter } from '../dashboard/server/src/routes/logs';
import { createCasesRouter } from '../dashboard/server/src/routes/cases';
import { createConfigRouter } from '../dashboard/server/src/routes/config';
import { createMiscRouter } from '../dashboard/server/src/routes/misc';
import { createMessagesRouter } from '../dashboard/server/src/routes/messages';

const fakeDb = {
  query: async () => [[{ id: 1, event: 'x', created_at: new Date() }], []],
  execute: async () => [{}],
} as never;

const ctx = {
  db: fakeDb,
  ownerUserId: '1',
  sessionSecret: 's',
  clientId: 'c',
  clientSecret: 'c',
  baseUrl: 'http://x',
  port: 1,
} as never;

const app = express();
const protectedApi = express.Router();
protectedApi.use((req: any, _res: any, next: any) => {
  req.userId = '1';
  next();
});
protectedApi.use('/logs', createApiRouter(ctx));
protectedApi.use('/cases', createCasesRouter(ctx));
protectedApi.use('/config', createConfigRouter(ctx));
protectedApi.use('/messages', createMessagesRouter(ctx));
protectedApi.use('/', createMiscRouter(ctx));
app.use('/api', protectedApi);

const server = app.listen(0, () => {
  const port = (server.address() as { port: number }).port;
  const paths = ['/api/logs', '/api/logs/', '/api/logs/log-events', '/api/logs/automod-logs', '/api/cases', '/api/cases/', '/api/messages', '/api/messages/channels', '/api/metrics', '/api/config/validate'];
  let i = 0;
  const nextReq = (): void => {
    if (i >= paths.length) {
      server.close();
      process.exit(0);
    }
    const p = paths[i++];
    http
      .get({ host: '127.0.0.1', port, path: p }, (res) => {
        let body = '';
        res.on('data', (c) => (body += c));
        res.on('end', () => console.log(`${p} -> ${res.statusCode} ${body.slice(0, 60)}`));
        nextReq();
      })
      .on('error', (err) => {
        console.log(`${p} -> ERROR ${err.message}`);
        nextReq();
      });
  };
  nextReq();
});