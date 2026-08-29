import { Router, type Request, type Response } from 'express';
import type { RowDataPacket } from 'mysql2/promise';
import type { DashboardContext } from '../context';
import { readSession, SESSION_COOKIE_NAME } from '../auth';

const EXPORT_COOLDOWN_MS = 3600_000; // 1 hour
const DELETE_COOLDOWN_MS = 7 * 24 * 3600_000; // 7 days

/** Tables that contain personal data keyed by user_id. */
const USER_TABLES: Array<{
  table: string;
  userColumn: string;
  label: string;
  /** Optional second column name + label for alternate ownership. */
  altColumn?: string;
  altLabel?: string;
  /** Columns to redact on deletion (set to '[deleted]'). */
  redactColumns?: string[];
}> = [
  { table: 'message_snapshots', userColumn: 'author_id', label: 'Message snapshots' },
  { table: 'reports', userColumn: 'reporter_id', label: 'Reports filed', altColumn: 'target_user_id', altLabel: 'Reports received' },
  { table: 'cases', userColumn: 'user_id', label: 'Moderation cases (as subject)', altColumn: 'moderator_id', altLabel: 'Moderation cases (as moderator)' },
  { table: 'warnings', userColumn: 'user_id', label: 'Active warnings' },
  { table: 'automod_triggers', userColumn: 'user_id', label: 'Automod triggers' },
  { table: 'automod_logs', userColumn: 'user_id', label: 'Automod log entries' },
  { table: 'reporter_stats', userColumn: 'user_id', label: 'Reporter credibility stats' },
  { table: 'sessions', userColumn: 'user_id', label: 'Dashboard sessions' },
  { table: 'afk', userColumn: 'user_id', label: 'AFK records' },
  { table: 'roblox_links', userColumn: 'user_id', label: 'Roblox account links' },
  { table: 'appeals', userColumn: 'user_id', label: 'Appeals filed' },
  { table: 'escalation_state', userColumn: 'user_id', label: 'Warning escalation state' },
];

export function createGdprRouter(ctx: DashboardContext): Router {
  const router = Router();

  // ── Helper: get authenticated user from session ──────────────────────────
  async function getUser(req: Request): Promise<string | null> {
    const cookie = req.cookies?.[SESSION_COOKIE_NAME] as string | undefined;
    if (!cookie) return null;
    const session = await readSession(ctx, cookie);
    return session?.userId ?? null;
  }

  // ── GET /api/gdpr/summary ────────────────────────────────────────────────
  router.get('/summary', async (req: Request, res: Response) => {
    const userId = await getUser(req);
    if (!userId) { res.status(401).json({ error: 'unauthorized' }); return; }

    const counts: Record<string, { count: number; label: string }> = {};
    for (const t of USER_TABLES) {
      const [rows] = await ctx.db.query<RowDataPacket[]>(
        `SELECT COUNT(*) AS cnt FROM ${t.table} WHERE ${t.userColumn} = ?`,
        [userId],
      );
      counts[t.userColumn] = { count: Number(rows[0]?.cnt ?? 0), label: t.label };
      if (t.altColumn) {
        const [altRows] = await ctx.db.query<RowDataPacket[]>(
          `SELECT COUNT(*) AS cnt FROM ${t.table} WHERE ${t.altColumn} = ?`,
          [userId],
        );
        counts[t.altColumn] = { count: Number(altRows[0]?.cnt ?? 0), label: t.altLabel ?? t.label };
      }
    }

    // Privacy prefs
    const [privRows] = await ctx.db.query<RowDataPacket[]>(
      'SELECT opt_out_snapshots, opt_out_automod_log, opt_out_report_target, export_last_at, delete_last_at FROM user_privacy WHERE user_id = ?',
      [userId],
    );
    const priv = privRows[0] as {
      opt_out_snapshots: number;
      opt_out_automod_log: number;
      opt_out_report_target: number;
      export_last_at: Date | null;
      delete_last_at: Date | null;
    } | undefined;

    res.json({
      userId,
      counts,
      privacy: {
        optOutSnapshots: priv?.opt_out_snapshots === 1,
        optOutAutomodLog: priv?.opt_out_automod_log === 1,
        optOutReportTarget: priv?.opt_out_report_target === 1,
      },
      rateLimits: {
        export: priv?.export_last_at ? Math.max(0, EXPORT_COOLDOWN_MS - (Date.now() - new Date(priv.export_last_at).getTime())) : 0,
        delete: priv?.delete_last_at ? Math.max(0, DELETE_COOLDOWN_MS - (Date.now() - new Date(priv.delete_last_at).getTime())) : 0,
      },
    });
  });

  // ── POST /api/gdpr/export ────────────────────────────────────────────────
  router.post('/export', async (req: Request, res: Response) => {
    const userId = await getUser(req);
    if (!userId) { res.status(401).json({ error: 'unauthorized' }); return; }

    // Rate limit: 1 export per hour
    const [privRows] = await ctx.db.query<RowDataPacket[]>(
      'SELECT export_last_at FROM user_privacy WHERE user_id = ?',
      [userId],
    );
    const last = (privRows[0] as { export_last_at: Date | null } | undefined)?.export_last_at;
    if (last && Date.now() - new Date(last).getTime() < EXPORT_COOLDOWN_MS) {
      res.status(429).json({
        error: 'rate_limited',
        retryAfterMs: EXPORT_COOLDOWN_MS - (Date.now() - new Date(last).getTime()),
        message: 'You can request another export in a few minutes.',
      });
      return;
    }

    // Update rate limit timestamp
    await ctx.db.execute(
      'INSERT INTO user_privacy (user_id, export_last_at) VALUES (?, NOW()) ON DUPLICATE KEY UPDATE export_last_at = NOW()',
      [userId],
    );

    // Collect all user data
    const exportData: Record<string, unknown> = { userId, exportedAt: new Date().toISOString() };
    for (const t of USER_TABLES) {
      const [rows] = await ctx.db.query<RowDataPacket[]>(
        `SELECT * FROM ${t.table} WHERE ${t.userColumn} = ? LIMIT 5000`,
        [userId],
      );
      exportData[t.label] = rows;
      if (t.altColumn) {
        const [altRows] = await ctx.db.query<RowDataPacket[]>(
          `SELECT * FROM ${t.table} WHERE ${t.altColumn} = ? LIMIT 5000`,
          [userId],
        );
        if (altRows.length > 0) exportData[t.altLabel!] = altRows;
      }
    }

    res.setHeader('Content-Disposition', `attachment; filename="gdpr-export-${userId}-${Date.now()}.json"`);
    res.setHeader('Content-Type', 'application/json');
    res.send(JSON.stringify(exportData, null, 2));
  });

  // ── POST /api/gdpr/delete ────────────────────────────────────────────────
  router.post('/delete', async (req: Request, res: Response) => {
    const userId = await getUser(req);
    if (!userId) { res.status(401).json({ error: 'unauthorized' }); return; }

    // Rate limit: 1 deletion request per 7 days
    const [privRows] = await ctx.db.query<RowDataPacket[]>(
      'SELECT delete_last_at FROM user_privacy WHERE user_id = ?',
      [userId],
    );
    const last = (privRows[0] as { delete_last_at: Date | null } | undefined)?.delete_last_at;
    if (last && Date.now() - new Date(last).getTime() < DELETE_COOLDOWN_MS) {
      res.status(429).json({
        error: 'rate_limited',
        retryAfterMs: DELETE_COOLDOWN_MS - (Date.now() - new Date(last).getTime()),
        message: 'You can request another deletion in a few days.',
      });
      return;
    }

    await ctx.db.execute(
      'INSERT INTO user_privacy (user_id, delete_last_at) VALUES (?, NOW()) ON DUPLICATE KEY UPDATE delete_last_at = NOW()',
      [userId],
    );

    // Anonymize personal data across all tables
    const placeholder = '?';
    let deleted = 0;

    // message_snapshots: anonymize content and author info
    const [snapRes] = await ctx.db.execute(
      `UPDATE message_snapshots SET content = '[deleted]', author_username = 'Deleted', author_nickname = NULL, author_avatar = '', embeds = '[]', attachments = '[]', referenced_message = NULL, edits = NULL WHERE author_id = ?`,
      [userId],
    );
    deleted += (snapRes as { affectedRows: number }).affectedRows;

    // reports: anonymize
    await ctx.db.execute(
      `UPDATE reports SET reason = '[deleted]', target_content = NULL WHERE reporter_id = ? OR target_user_id = ?`,
      [userId, userId],
    );

    // automod_triggers: anonymize content
    await ctx.db.execute(
      `UPDATE automod_triggers SET content_snippet = '[deleted]' WHERE user_id = ?`,
      [userId],
    );

    // automod_logs: anonymize
    await ctx.db.execute(
      `UPDATE automod_logs SET content_snippet = '[deleted]', stored_content = NULL WHERE user_id = ?`,
      [userId],
    );

    // sessions: revoke
    await ctx.db.execute(`UPDATE sessions SET revoked = 1 WHERE user_id = ?`, [userId]);

    // afk: clear
    await ctx.db.execute(`DELETE FROM afk WHERE user_id = ?`, [userId]);

    // warnings: anonymize
    await ctx.db.execute(`UPDATE warnings SET reason = '[deleted]' WHERE user_id = ?`, [userId]);

    // escalation: clear
    await ctx.db.execute(`DELETE FROM escalation_state WHERE user_id = ?`, [userId]);

    res.json({ success: true, deleted, message: 'Your personal data has been anonymized.' });
  });

  // ── POST /api/gdpr/opt-out ───────────────────────────────────────────────
  router.post('/opt-out', async (req: Request, res: Response) => {
    const userId = await getUser(req);
    if (!userId) { res.status(401).json({ error: 'unauthorized' }); return; }

    const { snapshots, automodLog, reportTarget } = req.body as {
      snapshots?: boolean;
      automodLog?: boolean;
      reportTarget?: boolean;
    };

    await ctx.db.execute(
      `INSERT INTO user_privacy (user_id) VALUES (?)
       ON DUPLICATE KEY UPDATE user_id = user_id`,
      [userId],
    );

    if (snapshots !== undefined) {
      await ctx.db.execute(
        `UPDATE user_privacy SET opt_out_snapshots = ? WHERE user_id = ?`,
        [snapshots ? 1 : 0, userId],
      );
    }
    if (automodLog !== undefined) {
      await ctx.db.execute(
        `UPDATE user_privacy SET opt_out_automod_log = ? WHERE user_id = ?`,
        [automodLog ? 1 : 0, userId],
      );
    }
    if (reportTarget !== undefined) {
      await ctx.db.execute(
        `UPDATE user_privacy SET opt_out_report_target = ? WHERE user_id = ?`,
        [reportTarget ? 1 : 0, userId],
      );
    }

    res.json({ success: true, message: 'Privacy preferences updated.' });
  });

  return router;
}