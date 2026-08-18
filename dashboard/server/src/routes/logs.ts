import { Router } from 'express';
import type { RowDataPacket } from 'mysql2/promise';
import type { DashboardContext } from '../context';

export function createApiRouter(ctx: DashboardContext): Router {
  const router = Router();

  router.get('/', async (req, res) => {
    const { event, actor, target, from, to, q, limit = 100, offset = 0 } = req.query as Record<string, string | undefined>;
    const where: string[] = [];
    const params: unknown[] = [];
    if (event) {
      where.push('event = ?');
      params.push(event);
    }
    if (actor) {
      where.push('actor_id = ?');
      params.push(actor);
    }
    if (target) {
      where.push('target_id = ?');
      params.push(target);
    }
    if (from) {
      where.push('created_at >= ?');
      params.push(new Date(from));
    }
    if (to) {
      where.push('created_at <= ?');
      params.push(new Date(to));
    }
    if (q) {
      where.push('(message LIKE ? OR details LIKE ?)');
      params.push(`%${q}%`, `%${q}%`);
    }
    const whereSql = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
    const [rows] = await ctx.db.query<RowDataPacket[]>(
      `SELECT id, event, guild_id, channel_id, actor_id, target_id, message, details, created_at FROM logs ${whereSql} ORDER BY id DESC LIMIT ? OFFSET ?`,
      [...params, Number(limit), Number(offset)],
    );
    const [countRows] = await ctx.db.query<RowDataPacket[]>(`SELECT COUNT(*) AS count FROM logs ${whereSql}`, params);
    res.json({ rows, total: Number(countRows[0]?.count ?? 0) });
  });

  router.get('/automod-logs', async (req, res) => {
    const { rule, user, channel, from, to, limit = 100, offset = 0 } = req.query as Record<string, string | undefined>;
    const where: string[] = [];
    const params: unknown[] = [];
    if (rule) {
      where.push('rule = ?');
      params.push(rule);
    }
    if (user) {
      where.push('user_id = ?');
      params.push(user);
    }
    if (channel) {
      where.push('channel_id = ?');
      params.push(channel);
    }
    if (from) {
      where.push('created_at >= ?');
      params.push(new Date(from));
    }
    if (to) {
      where.push('created_at <= ?');
      params.push(new Date(to));
    }
    const whereSql = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
    const [rows] = await ctx.db.query<RowDataPacket[]>(
      `SELECT id, rule, module, user_id, channel_id, message_id, content_snippet, response_suppressed, case_ids, created_at FROM automod_logs ${whereSql} ORDER BY id DESC LIMIT ? OFFSET ?`,
      [...params, Number(limit), Number(offset)],
    );
    res.json({ rows });
  });

  router.get('/log-events', async (_req, res) => {
    const [rows] = await ctx.db.query<RowDataPacket[]>(
      'SELECT DISTINCT event FROM logs ORDER BY event',
    );
    res.json({ events: rows.map((r) => r.event) });
  });

  return router;
}