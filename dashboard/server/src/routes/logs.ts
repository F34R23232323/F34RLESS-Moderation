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
      `SELECT l.id, l.event, l.guild_id, l.channel_id, l.actor_id, l.target_id, l.message, l.details, l.created_at,
              ga.username AS actor_username, ga.display_name AS actor_display_name,
              gt.username AS target_username, gt.display_name AS target_display_name
       FROM logs l
       LEFT JOIN guild_users ga ON ga.guild_id = l.guild_id AND ga.user_id = l.actor_id
       LEFT JOIN guild_users gt ON gt.guild_id = l.guild_id AND gt.user_id = l.target_id
       ${whereSql} ORDER BY l.id DESC LIMIT ? OFFSET ?`,
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
      `SELECT am.id, am.rule, am.module, am.user_id, am.channel_id, am.message_id, am.content_snippet, am.response_suppressed, am.case_ids, am.created_at,
              gu.username AS user_username, gu.display_name AS user_display_name
       FROM automod_logs am
       LEFT JOIN guild_users gu ON gu.guild_id = am.guild_id AND gu.user_id = am.user_id
       ${whereSql} ORDER BY am.id DESC LIMIT ? OFFSET ?`,
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