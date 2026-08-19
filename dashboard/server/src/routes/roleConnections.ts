import { Router } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import * as YAML from 'yaml';
import type { RowDataPacket } from 'mysql2/promise';
import type { DashboardContext } from '../context';
import {
  configSchema,
  evaluateConnectionResult,
  roleConnectionSchema,
} from '../../../../shared/src/index';

export function createRoleConnectionsRouter(ctx: DashboardContext): Router {
  const router = Router();

  function configPath(): string {
    return process.env.CONFIG_PATH ? process.env.CONFIG_PATH : path.resolve(process.cwd(), 'config.yml');
  }

  function readRoleConnections(): { enabled: boolean; sync_interval_minutes: number; connections: unknown[] } {
    const p = configPath();
    if (!fs.existsSync(p)) {
      return { enabled: true, sync_interval_minutes: 5, connections: [] };
    }
    const parsed = YAML.parse(fs.readFileSync(p, 'utf8')) as Record<string, unknown>;
    const result = configSchema.safeParse(parsed ?? {});
    if (!result.success) {
      return { enabled: true, sync_interval_minutes: 5, connections: [] };
    }
    const rc = result.data.role_connections;
    return {
      enabled: rc.enabled,
      sync_interval_minutes: rc.sync_interval_minutes,
      connections: rc.connections as unknown[],
    };
  }

  router.get('/', async (_req, res) => {
    const rc = readRoleConnections();
    const [roles] = await ctx.db.query<RowDataPacket[]>(
      `SELECT id, guild_id, name, color, position, managed
         FROM guild_roles
        ORDER BY guild_id, position DESC
        LIMIT 500`,
    );
    res.json({ ...rc, roles });
  });

  router.get('/roles', async (_req, res) => {
    const [roles] = await ctx.db.query<RowDataPacket[]>(
      `SELECT id, guild_id, name, color, position, managed
         FROM guild_roles
        ORDER BY guild_id, position DESC
        LIMIT 1000`,
    );
    res.json({ roles });
  });

  router.post('/validate-connection', (req, res) => {
    const body = req.body as { connection?: unknown };
    const result = roleConnectionSchema.safeParse(body.connection ?? {});
    if (!result.success) {
      res.json({
        ok: false,
        issues: result.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      });
      return;
    }
    res.json({ ok: true, connection: result.data });
  });

  // The simulation runs the exact same evaluation the bot uses, so the preview
  // always matches what config.yml will actually do.
  router.post('/simulate', (req, res) => {
    const body = req.body as { connection?: unknown; memberRoleIds?: string[] };
    const parsed = roleConnectionSchema.safeParse(body.connection ?? {});
    if (!parsed.success) {
      res.status(400).json({ error: 'invalid connection', issues: parsed.error.issues });
      return;
    }
    const memberRoleIds = new Set<string>(Array.isArray(body.memberRoleIds) ? body.memberRoleIds : []);
    const result = evaluateConnectionResult(parsed.data, memberRoleIds);
    res.json({ result, memberRoleIds: [...memberRoleIds] });
  });

  return router;
}
