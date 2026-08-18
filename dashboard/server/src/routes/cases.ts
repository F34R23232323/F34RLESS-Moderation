import { Router } from 'express';
import type { RowDataPacket } from 'mysql2/promise';
import type { DashboardContext } from '../context';

export function createCasesRouter(ctx: DashboardContext): Router {
  const router = Router();

  async function queueLog(
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

  router.get('/', async (req, res) => {
    const { user, type, status, from, to, q, limit = 100, offset = 0 } = req.query as Record<string, string | undefined>;
    const where: string[] = [];
    const params: unknown[] = [];
    if (user) {
      where.push('user_id = ?');
      params.push(user);
    }
    if (type) {
      where.push('type = ?');
      params.push(type);
    }
    if (status) {
      where.push('status = ?');
      params.push(status);
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
      where.push('reason LIKE ?');
      params.push(`%${q}%`);
    }
    const whereSql = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
    const [rows] = await ctx.db.query<RowDataPacket[]>(
      `SELECT id, case_number, case_code, guild_id, type, user_id, moderator_id, reason, status, created_at FROM cases ${whereSql} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [...params, Number(limit), Number(offset)],
    );
    const [countRows] = await ctx.db.query<RowDataPacket[]>(`SELECT COUNT(*) AS count FROM cases ${whereSql}`, params);
    res.json({ rows, total: Number(countRows[0]?.count ?? 0) });
  });

  async function loadCase(id: string): Promise<RowDataPacket | null> {
    const [rows] = await ctx.db.query<RowDataPacket[]>('SELECT * FROM cases WHERE id = ?', [id]);
    return rows[0] ?? null;
  }

  router.get('/:id', async (req, res) => {
    const c = await loadCase(req.params.id);
    if (!c) {
      res.status(404).json({ error: 'case not found' });
      return;
    }
    let linked: RowDataPacket[] = [];
    if (c.case_code || c.id) {
      const [links] = await ctx.db.query<RowDataPacket[]>(
        `SELECT lc.id, lc.case_number, lc.case_code, lc.type, lc.status, lc.reason
         FROM case_links cl
         JOIN cases lc ON lc.id = cl.linked_case_id
         WHERE cl.case_id = ?
         UNION
         SELECT lc.id, lc.case_number, lc.case_code, lc.type, lc.status, lc.reason
         FROM case_links cl
         JOIN cases lc ON lc.id = cl.case_id
         WHERE cl.linked_case_id = ?`,
        [c.id, c.id],
      );
      linked = links;
    }
    const [notes] = await ctx.db.query<RowDataPacket[]>(
      'SELECT id, guild_id, user_id, moderator_id, note, created_at, edited_at FROM notes WHERE guild_id = ? AND user_id = ? ORDER BY created_at DESC',
      [c.guild_id, c.user_id],
    );
    res.json({ case: c, linked, notes });
  });

  router.patch('/:id', async (req, res) => {
    const body = req.body as { reason?: string; status?: string };
    const c = await loadCase(req.params.id);
    if (!c) {
      res.status(404).json({ error: 'case not found' });
      return;
    }
    const details: Record<string, unknown> = {};
    if (body.reason !== undefined) {
      await ctx.db.execute('UPDATE cases SET reason = ? WHERE id = ?', [body.reason, req.params.id]);
      details.reason = { old: c.reason, new: body.reason };
    }
    if (body.status !== undefined) {
      await ctx.db.execute('UPDATE cases SET status = ? WHERE id = ?', [body.status, req.params.id]);
      details.status = { old: c.status, new: body.status };
    }
    if (Object.keys(details).length > 0) {
      await queueLog({
        guildId: c.guild_id,
        event: 'case_edit',
        actorId: (req as unknown as { userId?: string }).userId,
        targetId: c.user_id,
        message: `Case ${c.case_code} edited from the dashboard`,
        details,
      });
    }
    res.json({ ok: true });
  });

  router.post('/:id/void', async (req, res) => {
    const reason = (req.body as { reason?: string }).reason ?? '';
    const c = await loadCase(req.params.id);
    if (!c) {
      res.status(404).json({ error: 'case not found' });
      return;
    }
    if (c.status === 'voided') {
      res.json({ ok: true });
      return;
    }
    const suffix = reason ? `\nVoided: ${reason}` : '';
    await ctx.db.execute("UPDATE cases SET status = 'voided', reason = CONCAT(reason, ?) WHERE id = ?", [suffix, req.params.id]);
    if (c.type === 'warn') {
      await ctx.db.execute('UPDATE warnings SET active = 0 WHERE case_id = ?', [req.params.id]);
    }
    await queueLog({
      guildId: c.guild_id,
      event: 'case_voided',
      actorId: (req as unknown as { userId?: string }).userId,
      targetId: c.user_id,
      message: `Case ${c.case_code} voided from the dashboard`,
      details: reason ? { reason } : undefined,
    });
    res.json({ ok: true });
  });

  router.post('/:id/unvoid', async (req, res) => {
    const c = await loadCase(req.params.id);
    if (!c) {
      res.status(404).json({ error: 'case not found' });
      return;
    }
    if (c.status !== 'voided') {
      res.json({ ok: true });
      return;
    }
    await ctx.db.execute("UPDATE cases SET status = 'active' WHERE id = ?", [req.params.id]);
    await queueLog({
      guildId: c.guild_id,
      event: 'case_unvoided',
      actorId: (req as unknown as { userId?: string }).userId,
      targetId: c.user_id,
      message: `Case ${c.case_code} restored from the dashboard`,
    });
    res.json({ ok: true });
  });

  router.post('/:id/link', async (req, res) => {
    const { otherRef } = req.body as { otherRef?: string | number };
    const c = await loadCase(req.params.id);
    if (!c || !otherRef) {
      res.status(404).json({ error: 'case not found' });
      return;
    }
    const ref = String(otherRef).trim();
    const [other] = ref.match(/^\d+$/)
      ? await ctx.db.query<RowDataPacket[]>(
          'SELECT id, case_code FROM cases WHERE guild_id = ? AND case_number = ?',
          [c.guild_id, Number(ref)],
        )
      : await ctx.db.query<RowDataPacket[]>(
          'SELECT id, case_code FROM cases WHERE guild_id = ? AND case_code = ?',
          [c.guild_id, ref],
        );
    if (!other[0]) {
      res.status(404).json({ error: 'other case not found' });
      return;
    }
    const target = Number(req.params.id);
    const linked = Number(other[0].id);
    if (target !== linked) {
      await ctx.db.execute('INSERT IGNORE INTO case_links (case_id, linked_case_id) VALUES (?, ?)', [target, linked]);
      await ctx.db.execute('INSERT IGNORE INTO case_links (case_id, linked_case_id) VALUES (?, ?)', [linked, target]);
    }
    await queueLog({
      guildId: c.guild_id,
      event: 'case_linked',
      actorId: (req as unknown as { userId?: string }).userId,
      targetId: c.user_id,
      message: `Linked case ${c.case_code} and ${other[0].case_code} from the dashboard`,
    });
    res.json({ ok: true });
  });

  router.post('/bulk-edit', async (req, res) => {
    const { ids, reason } = req.body as { ids?: number[]; reason?: string };
    if (!Array.isArray(ids) || ids.length === 0 || typeof reason !== 'string') {
      res.status(400).json({ error: 'ids (array) and reason required' });
      return;
    }
    const placeholders = ids.map(() => '?').join(',');
    await ctx.db.execute(`UPDATE cases SET reason = ? WHERE id IN (${placeholders})`, [reason, ...ids]);
    const [rows] = await ctx.db.query<RowDataPacket[]>(
      `SELECT guild_id, user_id, case_code FROM cases WHERE id IN (${placeholders})`,
      ids,
    );
    const byGuild = new Map<string, { userId: string; codes: string[] }>();
    for (const r of rows) {
      let g = byGuild.get(r.guild_id);
      if (!g) {
        g = { userId: r.user_id, codes: [] };
        byGuild.set(r.guild_id, g);
      }
      g.codes.push(String(r.case_code));
    }
    const actorId = (req as unknown as { userId?: string }).userId;
    for (const [guildId, g] of byGuild) {
      await queueLog({
        guildId,
        event: 'case_edit',
        actorId,
        targetId: g.userId,
        message: `Bulk-edited ${g.codes.length} case(s) from the dashboard`,
        details: { count: g.codes.length, codes: g.codes, newReason: reason },
      });
    }
    res.json({ ok: true, updated: rows.length });
  });

  router.get('/:id/notes', async (req, res) => {
    const c = await loadCase(req.params.id);
    if (!c) {
      res.status(404).json({ error: 'case not found' });
      return;
    }
    const [rows] = await ctx.db.query<RowDataPacket[]>(
      'SELECT id, guild_id, user_id, moderator_id, note, created_at, edited_at FROM notes WHERE guild_id = ? AND user_id = ? ORDER BY created_at DESC',
      [c.guild_id, c.user_id],
    );
    res.json({ rows });
  });

  router.post('/:id/notes', async (req, res) => {
    const c = await loadCase(req.params.id);
    if (!c) {
      res.status(404).json({ error: 'case not found' });
      return;
    }
    const note = ((req.body as { note?: string }).note ?? '').trim();
    if (!note) {
      res.status(400).json({ error: 'note required' });
      return;
    }
    const [result] = await ctx.db.execute(
      'INSERT INTO notes (guild_id, user_id, moderator_id, note) VALUES (?, ?, ?, ?)',
      [c.guild_id, c.user_id, (req as unknown as { userId?: string }).userId ?? null, note],
    );
    await queueLog({
      guildId: c.guild_id,
      event: 'note_add',
      actorId: (req as unknown as { userId?: string }).userId,
      targetId: c.user_id,
      message: `Note added for <@${c.user_id}> from the dashboard`,
      details: { note },
    });
    res.json({ id: (result as { insertId: number }).insertId });
  });

  router.patch('/notes/:noteId', async (req, res) => {
    const note = ((req.body as { note?: string }).note ?? '').trim();
    if (!note) {
      res.status(400).json({ error: 'note required' });
      return;
    }
    const [rows] = await ctx.db.query<RowDataPacket[]>('SELECT guild_id, user_id FROM notes WHERE id = ?', [req.params.noteId]);
    if (!rows[0]) {
      res.status(404).json({ error: 'note not found' });
      return;
    }
    await ctx.db.execute('UPDATE notes SET note = ?, edited_at = NOW() WHERE id = ?', [note, req.params.noteId]);
    await queueLog({
      guildId: rows[0].guild_id,
      event: 'note_edit',
      actorId: (req as unknown as { userId?: string }).userId,
      targetId: rows[0].user_id,
      message: `Note edited for <@${rows[0].user_id}> from the dashboard`,
      details: { newNote: note },
    });
    res.json({ ok: true });
  });

  router.delete('/notes/:noteId', async (req, res) => {
    const [rows] = await ctx.db.query<RowDataPacket[]>('SELECT guild_id, user_id, note FROM notes WHERE id = ?', [req.params.noteId]);
    if (!rows[0]) {
      res.status(404).json({ error: 'note not found' });
      return;
    }
    await ctx.db.execute('DELETE FROM notes WHERE id = ?', [req.params.noteId]);
    await queueLog({
      guildId: rows[0].guild_id,
      event: 'note_remove',
      actorId: (req as unknown as { userId?: string }).userId,
      targetId: rows[0].user_id,
      message: `Note removed for <@${rows[0].user_id}> from the dashboard`,
      details: { removedNote: rows[0].note },
    });
    res.json({ ok: true });
  });

  return router;
}
