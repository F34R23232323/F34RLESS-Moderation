import { Router } from 'express';
import type { RowDataPacket } from 'mysql2/promise';
import type { DashboardContext } from '../context';
import { snowflakeToDate } from '../../../../shared/src/index';

let metricsCache: { data: unknown; expiresAt: number } | null = null;
const METRICS_CACHE_TTL_MS = 5_000;

export function createMiscRouter(ctx: DashboardContext): Router {
  const router = Router();

  router.get('/health', async (_req, res) => {
    try {
      await ctx.db.query('SELECT 1');
      res.json({ ok: true, status: 'healthy' });
    } catch {
      res.status(503).json({ ok: false, status: 'unhealthy' });
    }
  });

  router.get('/metrics', async (_req, res) => {
    if (metricsCache && metricsCache.expiresAt > Date.now()) {
      res.json(metricsCache.data);
      return;
    }
    const safeQuery = async (sql: string): Promise<number> => {
      try {
        const [rows] = await ctx.db.query<RowDataPacket[]>(sql);
        return Number((rows[0] as RowDataPacket)?.count ?? (rows[0] as RowDataPacket)?.total ?? 0);
      } catch {
        return 0;
      }
    };
    const [msgsMin, msgsHour, triggers, totalCmds, failedCmds] = await Promise.all([
      safeQuery('SELECT COUNT(*) AS count FROM logs WHERE created_at > DATE_SUB(NOW(), INTERVAL 60 SECOND)'),
      safeQuery('SELECT COUNT(*) AS count FROM logs WHERE created_at > DATE_SUB(NOW(), INTERVAL 3600 SECOND)'),
      safeQuery('SELECT COUNT(*) AS count FROM automod_logs WHERE created_at > DATE_SUB(NOW(), INTERVAL 3600 SECOND)'),
      safeQuery('SELECT COUNT(*) AS total FROM command_usage WHERE created_at > DATE_SUB(NOW(), INTERVAL 3600 SECOND)'),
      safeQuery('SELECT COUNT(*) AS count FROM command_usage WHERE success = 0 AND created_at > DATE_SUB(NOW(), INTERVAL 3600 SECOND)'),
    ]);
    const data = {
      messagesPerMinute: msgsMin,
      messagesPerHour: msgsHour,
      automodTriggersLastHour: triggers,
      commandsLastHour: totalCmds,
      commandsFailedLastHour: failedCmds,
      uptimeSeconds: Math.round(process.uptime()),
    };
    metricsCache = { data, expiresAt: Date.now() + METRICS_CACHE_TTL_MS };
    res.json(data);
  });

  router.get('/punishments', async (_req, res) => {
    const [rows] = await ctx.db.query<RowDataPacket[]>(
      'SELECT id, guild_id, user_id, type, case_id, expires_at, created_at FROM punishments WHERE active = 1 ORDER BY expires_at ASC',
    );
    const list = rows.map((r) => ({
      id: r.id,
      userId: r.user_id,
      type: r.type,
      caseId: r.case_id,
      expiresAt: r.expires_at,
      remainingMs: new Date(r.expires_at).getTime() - Date.now(),
    }));
    res.json({ rows: list });
  });

  router.post('/punishments/:id/revoke', async (req, res) => {
    await ctx.db.execute('UPDATE punishments SET active = 0 WHERE id = ?', [req.params.id]);
    res.json({ ok: true });
  });

  router.get('/analytics', async (_req, res) => {
    const [rows] = await ctx.db.query<RowDataPacket[]>(
      `SELECT command, surface, COUNT(*) AS uses,
        SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) AS success,
        SUM(CASE WHEN success = 0 THEN 1 ELSE 0 END) AS failed,
        ROUND(AVG(duration_ms)) AS avg_duration_ms
       FROM command_usage GROUP BY command, surface ORDER BY uses DESC LIMIT 100`,
    );
    res.json({ rows });
  });

  router.get('/regex-test', async (req, res) => {
    const { pattern, flags, text } = req.query as Record<string, string | undefined>;
    if (!pattern || text === undefined) {
      res.status(400).json({ error: 'pattern, flags, text required' });
      return;
    }
    try {
      const re = new RegExp(pattern, flags ?? 'g');
      const matches: Array<{ match: string; index: number }> = [];
      let m: RegExpExecArray | null;
      while ((m = re.exec(text)) !== null) {
        matches.push({ match: m[0], index: m.index });
        if (m[0].length === 0) re.lastIndex++;
        if (matches.length > 500) break;
      }
      res.json({ valid: true, matches });
    } catch (err) {
      res.json({ valid: false, error: (err as Error).message });
    }
  });

  router.get('/snowflake', (req, res) => {
    const id = req.query.id as string | undefined;
    if (!id) {
      res.status(400).json({ error: 'id required' });
      return;
    }
    const date = snowflakeToDate(id);
    res.json({ id, createdAt: date?.toISOString() ?? null });
  });

  router.get('/sessions', async (req, res) => {
    const [rows] = await ctx.db.query<RowDataPacket[]>(
      'SELECT id, token, ip, user_agent, created_at, expires_at, revoked FROM sessions ORDER BY created_at DESC LIMIT 50',
    );
    res.json({ rows });
  });

  router.post('/sessions/:id/revoke', async (req, res) => {
    await ctx.db.execute('UPDATE sessions SET revoked = 1 WHERE id = ?', [req.params.id]);
    res.json({ ok: true });
  });

  router.get('/export', async (_req, res) => {
    const tables = ['cases', 'warnings', 'notes', 'reports', 'custom_commands', 'automod_triggers'];
    const snapshot: Record<string, unknown> = {};
    for (const table of tables) {
      try {
        const [rows] = await ctx.db.query<RowDataPacket[]>(`SELECT * FROM ${table} LIMIT 5000`);
        snapshot[table] = rows;
      } catch {
        snapshot[table] = [];
      }
    }
    res.setHeader('Content-Disposition', 'attachment; filename="guild-snapshot.json"');
    res.json(snapshot);
  });

  return router;
}