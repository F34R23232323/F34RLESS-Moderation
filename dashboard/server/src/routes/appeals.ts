import { Router, type NextFunction, type Request, type Response } from 'express';
import { z } from 'zod';
import type { RowDataPacket } from 'mysql2/promise';
import type { DashboardContext } from '../context';
import { readSession, requireUserAuth, requireCsrf, SESSION_COOKIE_NAME } from '../auth';
import { resolveAppealConfig, sanitizeForDiscord, type AppealsConfig } from '../../../../shared/src/index';
import type { BotConfig } from '../../../../shared/src/index';

// ---------------------------------------------------------------------------
// Appeals API — every route is guild-scoped via :guildId and re-verifies the
// requester's membership (public routes) or staff status (admin routes)
// server-side before returning data. All mutating routes require a session +
// CSRF token. Nothing here trusts guildId/case ownership/eligibility from the
// client.
// ---------------------------------------------------------------------------

const submitBodySchema = z.object({
  caseId: z.number().int().positive(),
  answers: z.array(
    z.object({
      questionId: z.string().min(1).max(64),
      text: z.string().max(2000).optional(),
      bool: z.boolean().optional(),
    }),
  ),
});

const messageBodySchema = z.object({
  content: z.string().min(1).max(2000),
});

const decideBodySchema = z.object({
  decision: z.enum(['accepted', 'denied']),
  reason: z.string().max(500).default(''),
});

const blockBodySchema = z.object({
  userId: z.string().regex(/^\d{15,20}$/, 'Expected a Discord snowflake ID'),
  reason: z.string().max(500).optional(),
  durationMs: z.number().int().min(0).optional(),
});

const unblockBodySchema = z.object({
  userId: z.string().regex(/^\d{15,20}$/, 'Expected a Discord snowflake ID'),
});

// ── Helpers ─────────────────────────────────────────────────────────────────

function staffRoleIds(config: BotConfig): Set<string> {
  const ids = new Set<string>();
  for (const group of config.staff_permission_groups.groups) {
    if (!group.permissions.includes('appeal') && !group.permissions.includes('*')) continue;
    for (const r of group.roles) ids.add(r);
  }
  return ids;
}

async function queueLog(
  ctx: DashboardContext,
  input: { guildId: string; event: string; actorId?: string | null; targetId?: string | null; message?: string | null; details?: unknown },
): Promise<void> {
  try {
    await ctx.db.execute(
      "INSERT INTO dashboard_log_requests (guild_id, event, actor_id, target_id, message, details, status) VALUES (?, ?, ?, ?, ?, ?, 'pending')",
      [
        input.guildId,
        input.event,
        input.actorId ?? null,
        input.targetId ?? null,
        input.message ?? null,
        input.details ? JSON.stringify(input.details) : null,
      ],
    );
  } catch (err) {
    console.error(`queueLog (${input.event}) failed:`, err);
  }
}

/** Simple in-memory sliding-window rate limiter. */
function makeRateLimiter(limit: number, windowSeconds: number): (key: string) => boolean {
  const hits = new Map<string, number[]>();
  return (key: string): boolean => {
    const now = Date.now();
    const cutoff = now - windowSeconds * 1000;
    const list = (hits.get(key) ?? []).filter((t) => t > cutoff);
    if (list.length >= limit) {
      hits.set(key, list);
      return false;
    }
    list.push(now);
    hits.set(key, list);
    return true;
  };
}

const perUserSubmitLimiter = makeRateLimiter(5, 60);
const perIpSubmitLimiter = makeRateLimiter(20, 60);

async function loadAppeal(ctx: DashboardContext, guildId: string, appealId: number): Promise<RowDataPacket | null> {
  const [rows] = await ctx.db.query<RowDataPacket[]>(
    'SELECT * FROM appeals WHERE id = ? AND guild_id = ?',
    [appealId, guildId],
  );
  return rows[0] ?? null;
}

async function activeBlock(ctx: DashboardContext, guildId: string, userId: string): Promise<RowDataPacket | null> {
  const [rows] = await ctx.db.query<RowDataPacket[]>(
    `SELECT id, reason, expires_at FROM appeal_blocks
     WHERE guild_id = ? AND user_id = ? AND active = 1
       AND (expires_at IS NULL OR expires_at > NOW())
     ORDER BY blocked_at DESC LIMIT 1`,
    [guildId, userId],
  );
  return rows[0] ?? null;
}

/** Validate submitted answers against the guild's configured form. */
function validateAnswers(form: AppealsConfig['form'], answers: Array<{ questionId: string; text?: string; bool?: boolean }>): string | null {
  const byId = new Map(form.map((q) => [q.id, q]));
  const seen = new Set<string>();
  for (const a of answers) {
    const q = byId.get(a.questionId);
    if (!q) return `unknown question "${a.questionId}"`;
    if (q.type === 'checkbox') {
      if (typeof a.bool !== 'boolean') return `question "${q.id}" expects a boolean value`;
    } else {
      const text = typeof a.text === 'string' ? a.text : '';
      if (q.required && text.trim().length === 0) return `question "${q.id}" is required`;
      if (q.min_length !== undefined && text.length < q.min_length) return `question "${q.id}" is shorter than ${q.min_length} characters`;
      if (q.max_length !== undefined && text.length > q.max_length) return `question "${q.id}" is longer than ${q.max_length} characters`;
    }
    seen.add(a.questionId);
  }
  for (const q of form) {
    if (q.required && !seen.has(q.id)) return `question "${q.id}" is required`;
  }
  return null;
}

const getGuildId = (req: Request): string => req.params.guildId;

/** Owner OR guild-staff (role tier includes the `appeal` permission). */
async function staffAuthImpl(ctx: DashboardContext, guildId: string, req: Request, res: Response, next: NextFunction): Promise<void> {
  const session = await readSession(ctx, req.cookies?.[SESSION_COOKIE_NAME] as string | undefined);
  if (!session) {
    res.status(401).json({ error: 'unauthorized' });
    return;
  }
  (req as unknown as { userId: string }).userId = session.userId;
  (req as unknown as { sessionToken: string }).sessionToken = session.sessionToken;
  if (session.userId === ctx.ownerUserId) {
    next();
    return;
  }
  const roles = await ctx.guildAccess.memberRoles(guildId, session.userId);
  const staff = staffRoleIds(ctx.config);
  if (!roles.some((r) => staff.has(r))) {
    res.status(403).json({ error: 'forbidden' });
    return;
  }
  next();
}

/** Guild membership check (owner bypassed). 403 when not a member.
 *
 * A non-member is still admitted when they own a case or an open appeal in
 * the guild — this is what lets (banned/kicked) users appeal in the first
 * place. That proof is verified server-side against the DB, never trusted
 * from the client. */
async function memberAuthImpl(ctx: DashboardContext, guildId: string, req: Request, res: Response, next: NextFunction): Promise<void> {
  const userId = (req as unknown as { userId: string }).userId;
  if (userId === ctx.ownerUserId) {
    next();
    return;
  }
  const isMember = await ctx.guildAccess.isMember(guildId, userId);
  if (!isMember) {
    const [owned] = await ctx.db.query<RowDataPacket[]>(
      'SELECT 1 FROM cases WHERE guild_id = ? AND user_id = ? LIMIT 1',
      [guildId, userId],
    );
    if (owned.length === 0) {
      res.status(403).json({ error: 'not_member' });
      return;
    }
  }
  next();
}

function staffAuth(ctx: DashboardContext): (req: Request, res: Response, next: NextFunction) => Promise<void> {
  return (req, res, next) => staffAuthImpl(ctx, getGuildId(req), req, res, next);
}

function memberAuth(ctx: DashboardContext): (req: Request, res: Response, next: NextFunction) => Promise<void> {
  return (req, res, next) => memberAuthImpl(ctx, getGuildId(req), req, res, next);
}

// ── Router ──────────────────────────────────────────────────────────────────

export function createAppealsRouter(ctx: DashboardContext): Router {
  const router = Router();

  // Public config — no auth. Sanitized: no channel/role ids, no blocking config.
  router.get('/:guildId/config', async (req, res) => {
    const guildId = req.params.guildId as string;
    if (!/^\d{15,20}$/.test(guildId)) {
      res.status(400).json({ error: 'invalid guild id' });
      return;
    }
    const botInGuild = await ctx.guildAccess.botInGuild(guildId);
    if (!botInGuild) {
      res.status(404).json({ error: 'guild_not_found' });
      return;
    }
    const cfg = resolveAppealConfig(ctx.config.appeals, guildId);
    if (!cfg.enabled) {
      res.json({ enabled: false });
      return;
    }
    const info = await ctx.guildAccess.guildInfo(guildId);
    res.json({
      enabled: true,
      guildId,
      guildName: info?.name ?? null,
      guildIcon: info?.icon ?? null,
      eligiblePunishmentTypes: cfg.eligible_punishment_types,
      cooldownSeconds: cfg.cooldown_seconds,
      maxOpenAppealsPerUser: cfg.max_open_appeals_per_user,
      form: cfg.form,
    });
  });

  // Guild picker for the admin dashboard (owner sees all, staff see their own).
  router.get('/guilds', async (req, res) => {
    const session = await readSession(ctx, req.cookies?.[SESSION_COOKIE_NAME] as string | undefined);
    if (!session) {
      res.status(401).json({ error: 'unauthorized' });
      return;
    }
    const guilds = await ctx.guildAccess.listGuilds();
    const out: Array<{ id: string; name: string; icon: string | null }> = [];
    for (const g of guilds) {
      const cfg = resolveAppealConfig(ctx.config.appeals, g.id);
      if (!cfg.enabled) continue;
      if (session.userId === ctx.ownerUserId) {
        out.push(g);
        continue;
      }
      const roles = await ctx.guildAccess.memberRoles(g.id, session.userId);
      if (roles.some((r) => staffRoleIds(ctx.config).has(r))) out.push(g);
    }
    res.json({ guilds: out });
  });

  // ── Public user routes (session + membership required) ─────────────────────

  router.get('/:guildId/my-cases', requireUserAuth(ctx), memberAuth(ctx), async (req, res) => {
    const guildId = req.params.guildId as string;
    const userId = (req as unknown as { userId: string }).userId;
    const cfg = resolveAppealConfig(ctx.config.appeals, guildId);
    if (!cfg.enabled) {
      res.status(400).json({ error: 'appeals_disabled' });
      return;
    }
    const blocked = await activeBlock(ctx, guildId, userId);
    if (blocked) {
      res.json({
        blocked: { reason: blocked.reason, expiresAt: blocked.expires_at ?? null },
        cases: [],
        openAppeal: null,
      });
      return;
    }

    const [caseRows] = await ctx.db.query<RowDataPacket[]>(
      `SELECT id, case_number, case_code, type, reason, created_at, status
       FROM cases
       WHERE guild_id = ? AND user_id = ?
         AND type IN (${cfg.eligible_punishment_types.map(() => '?').join(',')})
         AND status != 'voided'
       ORDER BY created_at DESC
       LIMIT 50`,
      [guildId, userId, ...cfg.eligible_punishment_types],
    );

    const [openAppealRows] = await ctx.db.query<RowDataPacket[]>(
      "SELECT a.id, a.case_id, a.status FROM appeals a WHERE a.guild_id = ? AND a.user_id = ? AND a.status = 'pending'",
      [guildId, userId],
    );
    const appealedCaseIds = new Set(openAppealRows.map((r) => Number(r.case_id)));

    const cases = caseRows
      .filter((c) => !appealedCaseIds.has(Number(c.id)))
      .map((c) => ({
        id: Number(c.id),
        caseNumber: Number(c.case_number),
        caseCode: c.case_code,
        type: c.type,
        reason: String(c.reason ?? '').slice(0, 500),
        createdAt: c.created_at,
      }));

    res.json({
      blocked: null,
      cases,
      openAppeal: openAppealRows[0]
        ? { appealId: Number(openAppealRows[0].id), status: openAppealRows[0].status }
        : null,
      cooldownSeconds: cfg.cooldown_seconds,
      maxOpenAppealsPerUser: cfg.max_open_appeals_per_user,
    });
  });

  router.post('/:guildId', requireUserAuth(ctx), memberAuth(ctx), requireCsrf(ctx), async (req, res) => {
    const guildId = req.params.guildId as string;
    const userId = (req as unknown as { userId: string }).userId;
    const ip = req.ip ?? '0';
    if (!perUserSubmitLimiter(`u:${userId}`) || !perIpSubmitLimiter(`ip:${ip}`)) {
      res.status(429).json({ error: 'rate_limited' });
      return;
    }
    const cfg = resolveAppealConfig(ctx.config.appeals, guildId);
    if (!cfg.enabled) {
      res.status(400).json({ error: 'appeals_disabled' });
      return;
    }
    const parsed = submitBodySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'invalid body' });
      return;
    }
    const { caseId, answers } = parsed.data;

    const blocked = await activeBlock(ctx, guildId, userId);
    if (blocked) {
      res.status(403).json({ error: 'blocked', reason: blocked.reason, expiresAt: blocked.expires_at ?? null });
      return;
    }

    // Case must exist in this guild AND belong to the requester.
    const [caseRows] = await ctx.db.query<RowDataPacket[]>(
      'SELECT id, case_number, case_code, type FROM cases WHERE id = ? AND guild_id = ? AND user_id = ?',
      [caseId, guildId, userId],
    );
    const caseRow = caseRows[0] as { id: number; case_number: number; case_code: string; type: string } | undefined;
    if (!caseRow) {
      res.status(404).json({ error: 'case_not_found' });
      return;
    }
    if (!cfg.eligible_punishment_types.includes(caseRow.type as never)) {
      res.status(400).json({ error: 'case_not_eligible' });
      return;
    }

    const [openAppeals] = await ctx.db.query<RowDataPacket[]>(
      "SELECT id FROM appeals WHERE case_id = ? AND guild_id = ? AND status = 'pending'",
      [caseRow.id, guildId],
    );
    if (openAppeals.length > 0) {
      res.status(409).json({ error: 'already_appealed' });
      return;
    }

    // Cooldown between submissions for this user in this guild.
    const [lastRow] = await ctx.db.query<RowDataPacket[]>(
      'SELECT submitted_at FROM appeals WHERE guild_id = ? AND user_id = ? ORDER BY submitted_at DESC LIMIT 1',
      [guildId, userId],
    );
    if (lastRow[0]) {
      const elapsed = Date.now() - new Date(lastRow[0].submitted_at).getTime();
      if (cfg.cooldown_seconds > 0 && elapsed < cfg.cooldown_seconds * 1000) {
        res.status(429).json({ error: 'cooldown', retryAfterSeconds: Math.ceil((cfg.cooldown_seconds * 1000 - elapsed) / 1000) });
        return;
      }
    }

    // Max open appeals per user.
    const [openCount] = await ctx.db.query<RowDataPacket[]>(
      "SELECT COUNT(*) AS count FROM appeals WHERE guild_id = ? AND user_id = ? AND status = 'pending'",
      [guildId, userId],
    );
    if (Number(openCount[0]?.count ?? 0) >= cfg.max_open_appeals_per_user) {
      res.status(429).json({ error: 'max_open_appeals' });
      return;
    }

    const formError = validateAnswers(cfg.form, answers);
    if (formError) {
      res.status(400).json({ error: formError });
      return;
    }

    const conn = await ctx.db.getConnection();
    try {
      await conn.beginTransaction();
      const [ins] = await conn.execute(
        "INSERT INTO appeals (guild_id, case_id, user_id, status) VALUES (?, ?, ?, 'pending')",
        [guildId, caseRow.id, userId],
      );
      const appealId = (ins as { insertId: number }).insertId;

      for (const a of answers) {
        const q = cfg.form.find((f) => f.id === a.questionId);
        if (q?.type === 'checkbox') {
          await conn.execute(
            'INSERT INTO appeal_answers (appeal_id, question_id, answer_bool) VALUES (?, ?, ?)',
            [appealId, a.questionId, a.bool ? 1 : 0],
          );
        } else {
          await conn.execute(
            'INSERT INTO appeal_answers (appeal_id, question_id, answer_text) VALUES (?, ?, ?)',
            [appealId, a.questionId, sanitizeForDiscord(a.text ?? '', 2000)],
          );
        }
      }

      await conn.execute(
        "INSERT INTO appeal_messages (appeal_id, sender_type, sender_id, content) VALUES (?, 'user', ?, ?)",
        [appealId, userId, 'Appeal submitted'],
      );
      await conn.commit();
      await ctx.db.execute(
        "INSERT INTO appeal_actions (guild_id, appeal_id, action) VALUES (?, ?, 'post')",
        [guildId, appealId],
      );
      await queueLog(ctx, {
        guildId,
        event: 'appeal_created',
        actorId: userId,
        targetId: userId,
        message: `Appeal #${appealId} filed for case ${caseRow.case_code} (${caseRow.type})`,
        details: { appealId, caseId: caseRow.id, caseCode: caseRow.case_code },
      });
      res.status(201).json({ appealId, status: 'pending' });
    } catch (err) {
      await conn.rollback().catch(() => undefined);
      console.error('Appeal submission failed:', err);
      res.status(500).json({ error: 'submission_failed' });
    } finally {
      conn.release();
    }
  });

  // ── Status + chat (ownership or staff) ─────────────────────────────────────

  const accessFor = async (req: Request, guildId: string, appeal: RowDataPacket): Promise<'owner' | 'staff' | null> => {
    const userId = (req as unknown as { userId: string }).userId;
    if (String(appeal.user_id) === userId) return 'owner';
    if (userId === ctx.ownerUserId) return 'staff';
    const roles = await ctx.guildAccess.memberRoles(guildId, userId);
    return roles.some((r) => staffRoleIds(ctx.config).has(r)) ? 'staff' : null;
  };

  router.get('/:guildId/:appealId/status', requireUserAuth(ctx), memberAuth(ctx), async (req, res) => {
    const guildId = req.params.guildId as string;
    const appealId = Number(req.params.appealId);
    if (!Number.isInteger(appealId)) {
      res.status(400).json({ error: 'invalid appeal id' });
      return;
    }
    const appeal = await loadAppeal(ctx, guildId, appealId);
    if (!appeal) {
      res.status(404).json({ error: 'appeal_not_found' });
      return;
    }
    const access = await accessFor(req, guildId, appeal);
    if (!access) {
      res.status(403).json({ error: 'forbidden' });
      return;
    }
    const [caseRows] = await ctx.db.query<RowDataPacket[]>(
      'SELECT id, case_number, case_code, type, user_id, moderator_id, reason, created_at FROM cases WHERE id = ? AND guild_id = ?',
      [appeal.case_id, guildId],
    );
    const [answers] = await ctx.db.query<RowDataPacket[]>(
      'SELECT question_id, answer_text, answer_bool FROM appeal_answers WHERE appeal_id = ?',
      [appeal.id],
    );
    const timeline: Array<{ type: string; at: Date; detail?: unknown }> = [{ type: 'submitted', at: appeal.submitted_at }];
    if (appeal.status !== 'pending') {
      timeline.push({
        type: appeal.status,
        at: appeal.decided_at ?? appeal.submitted_at,
        detail: { decidedBy: appeal.decided_by, decisionReason: appeal.decision_reason },
      });
    }
    res.json({
      appeal: {
        id: Number(appeal.id),
        status: appeal.status,
        submittedAt: appeal.submitted_at,
        decidedAt: appeal.decided_at,
        decidedBy: appeal.decided_by,
        decisionReason: appeal.decision_reason,
      },
      case: caseRows[0] ?? null,
      answers,
      timeline,
      access,
      selfId: (req as unknown as { userId: string }).userId,
    });
  });

  router.get('/:guildId/:appealId/messages', requireUserAuth(ctx), memberAuth(ctx), async (req, res) => {
    const guildId = req.params.guildId as string;
    const appealId = Number(req.params.appealId);
    const appeal = await loadAppeal(ctx, guildId, appealId);
    if (!appeal) {
      res.status(404).json({ error: 'appeal_not_found' });
      return;
    }
    const access = await accessFor(req, guildId, appeal);
    if (!access) {
      res.status(403).json({ error: 'forbidden' });
      return;
    }
    const [rows] = await ctx.db.query<RowDataPacket[]>(
      'SELECT id, sender_type, sender_id, content, sent_at FROM appeal_messages WHERE appeal_id = ? ORDER BY id ASC',
      [appeal.id],
    );
    res.json({
      messages: rows.map((r) => ({
        id: Number(r.id),
        senderType: r.sender_type,
        senderId: r.sender_id,
        content: r.content,
        sentAt: r.sent_at,
      })),
      selfId: (req as unknown as { userId: string }).userId,
    });
  });

  router.post('/:guildId/:appealId/messages', requireUserAuth(ctx), memberAuth(ctx), requireCsrf(ctx), async (req, res) => {
    const guildId = req.params.guildId as string;
    const appealId = Number(req.params.appealId);
    const parsed = messageBodySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'invalid body' });
      return;
    }
    const appeal = await loadAppeal(ctx, guildId, appealId);
    if (!appeal) {
      res.status(404).json({ error: 'appeal_not_found' });
      return;
    }
    const access = await accessFor(req, guildId, appeal);
    if (!access) {
      res.status(403).json({ error: 'forbidden' });
      return;
    }
    const content = sanitizeForDiscord(parsed.data.content, 2000);
    if (!content) {
      res.status(400).json({ error: 'empty_message' });
      return;
    }
    const senderType = access === 'owner' ? 'user' : 'staff';
    const senderId = (req as unknown as { userId: string }).userId;
    const [ins] = await ctx.db.execute(
      'INSERT INTO appeal_messages (appeal_id, sender_type, sender_id, content) VALUES (?, ?, ?, ?)',
      [appeal.id, senderType, senderId, content],
    );
    const messageId = (ins as { insertId: number }).insertId;
    // Relay into the Discord thread (and DM the appellant if staff replies).
    await ctx.db.execute(
      "INSERT INTO appeal_actions (guild_id, appeal_id, action, payload) VALUES (?, ?, 'relay', ?)",
      [guildId, appeal.id, JSON.stringify({ messageId })],
    );
    res.status(201).json({ id: messageId });
  });

  // ── Staff/admin routes ─────────────────────────────────────────────────────

  router.get('/:guildId', staffAuth(ctx), async (req, res) => {
    const guildId = req.params.guildId as string;
    const { status, user, q, from, to, limit = 50, offset = 0 } = req.query as Record<string, string | undefined>;
    const where: string[] = ['a.guild_id = ?'];
    const params: unknown[] = [guildId];
    if (status) {
      where.push('a.status = ?');
      params.push(status);
    }
    if (user) {
      where.push('a.user_id = ?');
      params.push(user);
    }
    if (from) {
      where.push('a.submitted_at >= ?');
      params.push(new Date(from));
    }
    if (to) {
      where.push('a.submitted_at <= ?');
      params.push(new Date(to));
    }
    if (q) {
      where.push('(c.case_code LIKE ? OR c.case_number LIKE ?)');
      params.push(`%${q}%`, `%${q}%`);
    }
    const whereSql = where.join(' AND ');
    const [rows] = await ctx.db.query<RowDataPacket[]>(
      `SELECT a.id, a.case_id, a.user_id, a.status, a.submitted_at, a.decided_at, a.decided_by, a.decision_reason,
              c.case_number, c.case_code, c.type AS case_type, c.reason AS case_reason
       FROM appeals a
       JOIN cases c ON c.id = a.case_id
       WHERE ${whereSql}
       ORDER BY a.submitted_at DESC
       LIMIT ? OFFSET ?`,
      [...params, Number(limit), Number(offset)],
    );
    const [countRows] = await ctx.db.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS count FROM appeals a JOIN cases c ON c.id = a.case_id WHERE ${whereSql}`,
      params,
    );
    res.json({ rows, total: Number(countRows[0]?.count ?? 0) });
  });

  // Blocked-users listing for the admin dashboard.
  router.get('/:guildId/blocks', staffAuth(ctx), async (req, res) => {
    const guildId = req.params.guildId as string;
    const [rows] = await ctx.db.query<RowDataPacket[]>(
      `SELECT id, user_id, reason, blocked_by, blocked_at, expires_at
       FROM appeal_blocks
       WHERE guild_id = ? AND active = 1 AND (expires_at IS NULL OR expires_at > NOW())
       ORDER BY blocked_at DESC
       LIMIT 200`,
      [guildId],
    );
    res.json({
      rows: rows.map((r) => ({
        id: Number(r.id),
        userId: r.user_id,
        reason: r.reason,
        blockedBy: r.blocked_by,
        blockedAt: r.blocked_at,
        expiresAt: r.expires_at,
      })),
    });
  });

  router.get('/:guildId/:appealId', staffAuth(ctx), async (req, res) => {
    const guildId = req.params.guildId as string;
    const appealId = Number(req.params.appealId);
    const appeal = await loadAppeal(ctx, guildId, appealId);
    if (!appeal) {
      res.status(404).json({ error: 'appeal_not_found' });
      return;
    }
    const [caseRows] = await ctx.db.query<RowDataPacket[]>(
      'SELECT * FROM cases WHERE id = ? AND guild_id = ?',
      [appeal.case_id, guildId],
    );
    const [answers] = await ctx.db.query<RowDataPacket[]>(
      'SELECT question_id, answer_text, answer_bool FROM appeal_answers WHERE appeal_id = ?',
      [appeal.id],
    );
    const [messages] = await ctx.db.query<RowDataPacket[]>(
      'SELECT id, sender_type, sender_id, content, sent_at FROM appeal_messages WHERE appeal_id = ? ORDER BY id ASC',
      [appeal.id],
    );
    const cfg = resolveAppealConfig(ctx.config.appeals, guildId);
    const formLabels = new Map(cfg.form.map((q) => [q.id, q.label]));
    res.json({
      appeal,
      case: caseRows[0] ?? null,
      answers: answers.map((a) => ({
        questionId: a.question_id,
        label: formLabels.get(a.question_id) ?? a.question_id,
        answerText: a.answer_text,
        answerBool: a.answer_bool,
      })),
      messages: messages.map((r) => ({
        id: Number(r.id),
        senderType: r.sender_type,
        senderId: r.sender_id,
        content: r.content,
        sentAt: r.sent_at,
      })),
    });
  });

  router.post('/:guildId/:appealId/decide', staffAuth(ctx), requireCsrf(ctx), async (req, res) => {
    const guildId = req.params.guildId as string;
    const appealId = Number(req.params.appealId);
    const parsed = decideBodySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'invalid body' });
      return;
    }
    const { decision, reason } = parsed.data;
    const appeal = await loadAppeal(ctx, guildId, appealId);
    if (!appeal) {
      res.status(404).json({ error: 'appeal_not_found' });
      return;
    }
    const finalReason = reason.trim() || (decision === 'accepted' ? 'Punishment reversed.' : 'Punishment stands.');
    const actorId = (req as unknown as { userId: string }).userId;
    const [result] = await ctx.db.execute(
      "UPDATE appeals SET status = ?, decided_at = NOW(), decided_by = ?, decision_reason = ? WHERE id = ? AND guild_id = ? AND status = 'pending'",
      [decision, actorId, finalReason, appeal.id, guildId],
    );
    if ((result as { affectedRows: number }).affectedRows === 0) {
      res.status(409).json({ error: 'already_decided' });
      return;
    }
    await ctx.db.execute(
      "INSERT INTO appeal_messages (appeal_id, sender_type, sender_id, content) VALUES (?, 'staff', ?, ?)",
      [appeal.id, actorId, `Appeal ${decision} — ${finalReason}`],
    );
    await ctx.db.execute(
      "INSERT INTO appeal_actions (guild_id, appeal_id, action) VALUES (?, ?, 'decide')",
      [guildId, appeal.id],
    );
    await queueLog(ctx, {
      guildId,
      event: 'appeal_resolved',
      actorId,
      targetId: appeal.user_id,
      message: `Appeal #${appeal.id} ${decision} from the dashboard`,
      details: { appealId: appeal.id, status: decision, decisionReason: finalReason },
    });
    res.json({ ok: true, status: decision });
  });

  router.post('/:guildId/:appealId/ignore', staffAuth(ctx), requireCsrf(ctx), async (req, res) => {
    const guildId = req.params.guildId as string;
    const appealId = Number(req.params.appealId);
    const appeal = await loadAppeal(ctx, guildId, appealId);
    if (!appeal) {
      res.status(404).json({ error: 'appeal_not_found' });
      return;
    }
    const actorId = (req as unknown as { userId: string }).userId;
    const [result] = await ctx.db.execute(
      "UPDATE appeals SET status = 'ignored', decided_at = NOW(), decided_by = ?, decision_reason = 'Closed without a ruling.' WHERE id = ? AND guild_id = ? AND status = 'pending'",
      [actorId, appeal.id, guildId],
    );
    if ((result as { affectedRows: number }).affectedRows === 0) {
      res.status(409).json({ error: 'already_decided' });
      return;
    }
    await ctx.db.execute(
      "INSERT INTO appeal_messages (appeal_id, sender_type, sender_id, content) VALUES (?, 'staff', ?, ?)",
      [appeal.id, actorId, 'Appeal ignored — closed without a ruling.'],
    );
    await ctx.db.execute(
      "INSERT INTO appeal_actions (guild_id, appeal_id, action) VALUES (?, ?, 'decide')",
      [guildId, appeal.id],
    );
    await queueLog(ctx, {
      guildId,
      event: 'appeal_resolved',
      actorId,
      targetId: appeal.user_id,
      message: `Appeal #${appeal.id} ignored from the dashboard`,
      details: { appealId: appeal.id, status: 'ignored' },
    });
    res.json({ ok: true, status: 'ignored' });
  });

  router.post('/:guildId/block', staffAuth(ctx), requireCsrf(ctx), async (req, res) => {
    const guildId = req.params.guildId as string;
    const parsed = blockBodySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'invalid body' });
      return;
    }
    const { userId, reason, durationMs } = parsed.data;
    const cfg = resolveAppealConfig(ctx.config.appeals, guildId);
    const finalReason = (reason ?? '').trim() || cfg.blocking.default_reason;
    const expiresAt = durationMs && durationMs > 0 ? new Date(Date.now() + durationMs) : null;
    await ctx.db.execute(
      'UPDATE appeal_blocks SET active = 0 WHERE guild_id = ? AND user_id = ? AND active = 1',
      [guildId, userId],
    );
    await ctx.db.execute(
      'INSERT INTO appeal_blocks (guild_id, user_id, reason, blocked_by, expires_at) VALUES (?, ?, ?, ?, ?)',
      [guildId, userId, finalReason, (req as unknown as { userId: string }).userId, expiresAt],
    );
    await queueLog(ctx, {
      guildId,
      event: 'moderation_action',
      actorId: (req as unknown as { userId: string }).userId,
      targetId: userId,
      message: `Blocked <@${userId}> from submitting appeals`,
      details: { reason: finalReason, expiresAt: expiresAt?.toISOString() ?? null },
    });
    res.json({ ok: true });
  });

  router.post('/:guildId/unblock', staffAuth(ctx), requireCsrf(ctx), async (req, res) => {
    const guildId = req.params.guildId as string;
    const parsed = unblockBodySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'invalid body' });
      return;
    }
    const { userId } = parsed.data;
    await ctx.db.execute(
      'UPDATE appeal_blocks SET active = 0 WHERE guild_id = ? AND user_id = ? AND active = 1',
      [guildId, userId],
    );
    await queueLog(ctx, {
      guildId,
      event: 'moderation_action',
      actorId: (req as unknown as { userId: string }).userId,
      targetId: userId,
      message: `Unblocked <@${userId}> from submitting appeals`,
    });
    res.json({ ok: true });
  });

  return router;
}
