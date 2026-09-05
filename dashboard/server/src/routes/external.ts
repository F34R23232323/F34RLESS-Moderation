import { Router, type Request, type Response, type NextFunction } from 'express';
import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import type { DashboardContext } from '../context';
import { matchesApiKey } from '../apiKeys';
import { generateCaseCode } from '../../../../shared/src/index';

/**
 * Public HTTP API for external bots.
 *
 * Auth: `Authorization: Bearer <key>` where <key> is the single `API_KEYS`
 * env var value.
 *
 * Supported punishment types: warn, mute, timeout, kick, ban, softban, unban,
 * unmute. `mute` and `timeout` are equivalent.
 */

const PUNISH_TYPES = new Set(['warn', 'mute', 'timeout', 'kick', 'ban', 'softban', 'unban', 'unmute']);

/** Source attribution recorded on cases/logs for API-originated actions. */
const SOURCE = 'external-api';

interface PunishPayload {
  guildId?: string;
  type?: string;
  userId?: string;
  reason?: string;
  duration?: string | number | null;
  durationMs?: string | number | null;
  deleteMessageDays?: number;
  evidence?: unknown[];
  /** "execute" (default) performs the native Discord action; "log" only records a case. */
  action?: 'execute' | 'log';
}

function requireApiKey(apiKey: string | null) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const header = (req.headers['authorization'] as string | undefined) ?? '';
    const match = /^Bearer\s+(\S+)$/i.exec(header);
    if (!matchesApiKey(apiKey, match ? match[1] : '')) {
      res.status(401).json({ error: 'invalid or missing API key' });
      return;
    }
    next();
  };
}

const SNOWFLAKE = /^\d{15,20}$/;

function parseDuration(value: string | number | null | undefined): number | null {
  if (value === undefined || value === null) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? Math.max(0, Math.round(value)) : null;
  if (/^\d+$/.test(value)) return Number(value);
  // Humanize simple durations: 1h, 30m, 2d, 90s
  const m = /^(\d+(?:\.\d+)?)\s*(ms|s|m|h|d|w)$/i.exec(value.trim());
  if (!m) return null;
  const n = parseFloat(m[1]);
  const unit = m[2].toLowerCase();
  const factors: Record<string, number> = { ms: 1, s: 1000, m: 60000, h: 3600000, d: 86400000, w: 604800000 };
  return Math.round(n * factors[unit]);
}

export function createExternalApiRouter(ctx: DashboardContext): Router {
  const router = Router();
  router.use(requireApiKey(ctx.apiKey));

  /** Insert a case row directly (log-only path). Mirrors CaseService.createCase. */
  async function insertCase(input: {
    guildId: string;
    type: string;
    userId: string;
    moderatorId: string | null;
    reason: string;
    durationMs?: number | null;
    evidence?: unknown[];
    status?: string;
  }): Promise<RowDataPacket | null> {
    for (let attempt = 0; attempt < 10; attempt++) {
      const caseNumber = await nextCaseNumber(input.guildId);
      const caseCode = generateCaseCode();
      try {
        const [result] = await ctx.db.execute<ResultSetHeader>(
          `INSERT INTO cases (case_number, case_code, guild_id, type, user_id, moderator_id, reason, duration_ms, evidence, linked_case_ids, status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            caseNumber,
            caseCode,
            input.guildId,
            input.type,
            input.userId,
            input.moderatorId,
            input.reason,
            input.durationMs ?? null,
            JSON.stringify(input.evidence ?? []),
            '[]',
            input.status ?? 'active',
          ],
        );
        const [rows] = await ctx.db.query<RowDataPacket[]>('SELECT * FROM cases WHERE id = ?', [result.insertId]);
        return rows[0] ?? null;
      } catch (err) {
        if ((err as { code?: string }).code === 'ER_DUP_ENTRY') continue;
        throw err;
      }
    }
    return null;
  }

  async function nextCaseNumber(guildId: string): Promise<number> {
    const [rows] = await ctx.db.query<RowDataPacket[]>(
      'SELECT COALESCE(MAX(case_number), 0) + 1 AS next FROM cases WHERE guild_id = ?',
      [guildId],
    );
    return Number((rows[0] as { next?: unknown } | undefined)?.next ?? 1);
  }

  async function logEntry(input: {
    event: string;
    guildId: string;
    actorId?: string | null;
    targetId?: string | null;
    message?: string;
    details?: unknown;
  }): Promise<void> {
    try {
      await ctx.db.execute(
        `INSERT INTO logs (event, guild_id, actor_id, target_id, message, details)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          input.event,
          input.guildId,
          input.actorId ?? null,
          input.targetId ?? null,
          input.message ?? null,
          input.details ? JSON.stringify(input.details) : null,
        ],
      );
    } catch (err) {
      console.error(`logEntry (${input.event}) failed:`, err);
    }
  }

  /** Record every API request for audit. */
  async function recordRequest(input: {
    source: string;
    guildId: string;
    method: string;
    path: string;
    statusCode: number;
    ip?: string | null;
    payload?: unknown;
    response?: unknown;
    error?: string | null;
  }): Promise<void> {
    try {
      await ctx.db.execute(
        `INSERT INTO api_request_logs (source, guild_id, method, path, status_code, ip, payload, response, error)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          input.source,
          input.guildId,
          input.method,
          input.path,
          input.statusCode,
          input.ip ?? null,
          input.payload !== undefined ? JSON.stringify(input.payload) : null,
          input.response !== undefined ? JSON.stringify(input.response) : null,
          input.error ?? null,
        ],
      );
    } catch (err) {
      console.error('recordRequest failed:', err);
    }
  }

  // ── POST /punish ──────────────────────────────────────────────────────────
  router.post('/punish', async (req, res) => {
    const source = SOURCE;
    const body = (req.body ?? {}) as PunishPayload;
    const guildId = body.guildId?.trim();
    const type = body.type?.trim().toLowerCase();
    const userId = body.userId?.trim();
    const reason = typeof body.reason === 'string' && body.reason.trim() ? body.reason.trim() : 'No reason provided';
    const actionMode = body.action === 'log' ? 'log' : 'execute';

    const base = { source, guildId: guildId ?? '', method: req.method, path: req.originalUrl ?? req.url, ip: req.ip ?? null };

    if (!guildId || !SNOWFLAKE.test(guildId)) {
      const error = 'guildId must be a valid Discord snowflake';
      res.status(400).json({ error });
      await recordRequest({ ...base, statusCode: 400, payload: body, error });
      return;
    }
    if (!type || !PUNISH_TYPES.has(type)) {
      const error = `type must be one of: ${[...PUNISH_TYPES].join(', ')}`;
      res.status(400).json({ error });
      await recordRequest({ ...base, statusCode: 400, payload: body, error });
      return;
    }
    if (!userId || !SNOWFLAKE.test(userId)) {
      const error = 'userId must be a valid Discord snowflake';
      res.status(400).json({ error });
      await recordRequest({ ...base, statusCode: 400, payload: body, error });
      return;
    }

    const durationMs = parseDuration(body.durationMs ?? body.duration);
    const deleteMessageDays = body.deleteMessageDays !== undefined ? Math.max(0, Math.floor(Number(body.deleteMessageDays) || 0)) : undefined;
    const evidence = Array.isArray(body.evidence) ? body.evidence : undefined;

    // Duration is only meaningful for timed punishments. If a duration was
    // supplied for one of these but could not be parsed, reject it so callers
    // don't get an unintended permanent ban/mute.
    if (['mute', 'timeout', 'ban'].includes(type) && durationMs === null && (body.duration !== undefined || body.durationMs !== undefined)) {
      const error = 'duration could not be parsed';
      res.status(400).json({ error });
      await recordRequest({ ...base, statusCode: 400, payload: body, error });
      return;
    }

    // ── Log-only: create the case + log entry right here ───────────────────
    if (actionMode === 'log') {
      try {
        const caseRow = await insertCase({
          guildId,
          type,
          userId,
          moderatorId: null,
          reason,
          durationMs: ['mute', 'timeout', 'ban', 'tempban'].includes(type) ? durationMs : null,
          evidence,
        });
        if (!caseRow) {
          const error = 'failed to create case';
          res.status(500).json({ error });
          await recordRequest({ ...base, statusCode: 500, payload: body, error });
          return;
        }
        await logEntry({
          event: 'moderation_action',
          guildId,
          targetId: userId,
          message: `API (${source}): external punishment logged for <@${userId}> (case ${caseRow.case_code})`,
          details: { type, caseCode: caseRow.case_code, reason, source, executed: false },
        });
        const response = {
          ok: true,
          action: 'log',
          case: {
            id: caseRow.id,
            caseNumber: caseRow.case_number,
            caseCode: caseRow.case_code,
            type: caseRow.type,
            userId: caseRow.user_id,
            status: caseRow.status,
            createdAt: caseRow.created_at,
          },
        };
        res.status(201).json(response);
        await recordRequest({ ...base, statusCode: 201, payload: body, response });
      } catch (err) {
        const error = (err as Error).message;
        res.status(500).json({ error });
        await recordRequest({ ...base, statusCode: 500, payload: body, error });
      }
      return;
    }

    // ── Execute: queue for the bot to perform the native action ────────────
    try {
      const [result] = await ctx.db.execute<ResultSetHeader>(
        `INSERT INTO api_case_requests
          (source, guild_id, type, user_id, moderator_id, reason, duration_ms, delete_message_days, evidence, action, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 'pending')`,
        [
          source,
          guildId,
          type,
          userId,
          null,
          reason,
          durationMs,
          deleteMessageDays ?? null,
          evidence !== undefined ? JSON.stringify(evidence) : null,
        ],
      );
      const response = {
        ok: true,
        action: 'execute',
        status: 'queued',
        requestId: result.insertId,
      };
      res.status(202).json(response);
      await recordRequest({ ...base, statusCode: 202, payload: body, response });
    } catch (err) {
      const error = (err as Error).message;
      res.status(500).json({ error });
      await recordRequest({ ...base, statusCode: 500, payload: body, error });
    }
  });

  // ── GET /cases ────────────────────────────────────────────────────────────
  router.get('/cases', async (req, res) => {
    const source = SOURCE;
    const guildId = (req.query.guildId as string | undefined)?.trim();
    const userId = (req.query.userId as string | undefined)?.trim();
    const type = (req.query.type as string | undefined)?.trim();
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
    const offset = Math.max(0, Number(req.query.offset) || 0);

    const base = { source, guildId: guildId ?? '', method: req.method, path: req.originalUrl ?? req.url, ip: req.ip ?? null };
    if (!guildId || !SNOWFLAKE.test(guildId)) {
      const error = 'guildId query param is required and must be a valid Discord snowflake';
      res.status(400).json({ error });
      await recordRequest({ ...base, statusCode: 400, error });
      return;
    }

    const where = ['guild_id = ?'];
    const params: unknown[] = [guildId];
    if (userId) {
      if (!SNOWFLAKE.test(userId)) {
        const error = 'userId must be a valid Discord snowflake';
        res.status(400).json({ error });
        await recordRequest({ ...base, statusCode: 400, error });
        return;
      }
      where.push('user_id = ?');
      params.push(userId);
    }
    if (type) {
      where.push('type = ?');
      params.push(type);
    }
    params.push(limit, offset);

    try {
      const [rows] = await ctx.db.query<RowDataPacket[]>(
        `SELECT id, case_number, case_code, guild_id, type, user_id, moderator_id, reason, duration_ms, status, created_at
         FROM cases WHERE ${where.join(' AND ')} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
        params,
      );
      const [countRows] = await ctx.db.query<RowDataPacket[]>(
        `SELECT COUNT(*) AS count FROM cases WHERE ${where.join(' AND ')}`,
        params.slice(0, -2),
      );
      const response = {
        rows: rows.map((r) => ({
          id: r.id,
          caseNumber: r.case_number,
          caseCode: r.case_code,
          type: r.type,
          userId: r.user_id,
          reason: r.reason,
          status: r.status,
          createdAt: r.created_at,
        })),
        total: Number(countRows[0]?.count ?? 0),
        limit,
        offset,
      };
      res.json(response);
      await recordRequest({ ...base, statusCode: 200, response });
    } catch (err) {
      const error = (err as Error).message;
      res.status(500).json({ error });
      await recordRequest({ ...base, statusCode: 500, error });
    }
  });

  // ── GET /requests/:id — poll the status of a queued execute request ─────
  router.get('/requests/:id', async (req, res) => {
    const source = SOURCE;
    const id = Number(req.params.id);
    const base = { source, guildId: '', method: req.method, path: req.originalUrl ?? req.url, ip: req.ip ?? null };
    if (!Number.isInteger(id) || id <= 0) {
      const error = 'invalid request id';
      res.status(400).json({ error });
      await recordRequest({ ...base, statusCode: 400, error });
      return;
    }
    try {
      const [rows] = await ctx.db.query<RowDataPacket[]>(
        'SELECT id, source, guild_id, type, user_id, reason, duration_ms, action, status, case_id, error, created_at, processed_at FROM api_case_requests WHERE id = ?',
        [id],
      );
      const row = rows[0];
      if (!row) {
        const error = 'request not found';
        res.status(404).json({ error });
        await recordRequest({ ...base, statusCode: 404, error });
        return;
      }
      const response = {
        id: row.id,
        guildId: row.guild_id,
        type: row.type,
        userId: row.user_id,
        reason: row.reason,
        action: Number(row.action) === 1 ? 'execute' : 'log',
        status: row.status,
        caseId: row.case_id ?? null,
        error: row.error ?? null,
        createdAt: row.created_at,
        processedAt: row.processed_at ?? null,
      };
      res.json(response);
      await recordRequest({ ...base, statusCode: 200, response });
    } catch (err) {
      const error = (err as Error).message;
      res.status(500).json({ error });
      await recordRequest({ ...base, statusCode: 500, error });
    }
  });

  return router;
}
