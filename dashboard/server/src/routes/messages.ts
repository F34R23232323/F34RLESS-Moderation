import { Router } from 'express';
import type { RowDataPacket } from 'mysql2/promise';
import type { DashboardContext } from '../context';

export function createMessagesRouter(ctx: DashboardContext): Router {
  const router = Router();

  router.get('/', async (req, res) => {
    const guildId = (req.query.guild as string) || '';
    const [rows] = guildId
      ? await ctx.db.query<RowDataPacket[]>(
          'SELECT id, guild_id, name, kind, payload, created_by, created_at, updated_at FROM saved_messages WHERE guild_id = ? ORDER BY updated_at DESC LIMIT 200',
          [guildId],
        )
      : await ctx.db.query<RowDataPacket[]>(
          'SELECT id, guild_id, name, kind, payload, created_by, created_at, updated_at FROM saved_messages ORDER BY updated_at DESC LIMIT 200',
        );
    res.json({ rows: rows as unknown as unknown[] });
  });

  router.get('/channels', async (_req, res) => {
    const [rows] = await ctx.db.query<RowDataPacket[]>(
      'SELECT id, guild_id, name, type, parent_id, position FROM guild_channels ORDER BY guild_id, parent_id, position, name LIMIT 500',
    );
    res.json({ rows: rows as unknown as unknown[] });
  });

  router.get('/roles', async (_req, res) => {
    const [rows] = await ctx.db.query<RowDataPacket[]>(
      'SELECT id, guild_id, name, color, position, hoist, managed FROM guild_roles ORDER BY guild_id, position DESC, name LIMIT 500',
    );
    res.json({ rows: rows as unknown as unknown[] });
  });

  router.get('/:id/sent', async (req, res) => {
    const [rows] = await ctx.db.query<RowDataPacket[]>(
      'SELECT id, channel_id, message_id, created_at FROM sent_messages WHERE saved_message_id = ? ORDER BY id DESC LIMIT 1',
      [req.params.id],
    );
    res.json({ messageId: rows[0]?.message_id ?? null, channelId: rows[0]?.channel_id ?? null, createdAt: rows[0]?.created_at ?? null });
  });

  router.get('/:id', async (req, res) => {
    const [rows] = await ctx.db.query<RowDataPacket[]>(
      'SELECT id, guild_id, name, kind, payload, created_by, created_at, updated_at FROM saved_messages WHERE id = ?',
      [req.params.id],
    );
    if (rows.length === 0) {
      res.status(404).json({ error: 'not found' });
      return;
    }
    res.json({ message: rows[0] });
  });

  router.post('/', async (req, res) => {
    const body = req.body as { guildId?: string; name?: string; kind?: string; payload?: unknown };
    if (!body.guildId || !body.name || !body.payload || (body.kind !== 'v1' && body.kind !== 'v2')) {
      res.status(400).json({ error: 'guildId, name, kind (v1|v2) and payload required' });
      return;
    }
    const [result] = await ctx.db.execute(
      'INSERT INTO saved_messages (guild_id, name, kind, payload, created_by) VALUES (?, ?, ?, ?, ?)',
      [body.guildId, body.name, body.kind, JSON.stringify(body.payload), (req as unknown as { userId?: string }).userId ?? null],
    );
    res.json({ id: (result as { insertId: number }).insertId });
  });

  router.patch('/:id', async (req, res) => {
    const body = req.body as { name?: string; kind?: string; payload?: unknown };
    if (body.name !== undefined) await ctx.db.execute('UPDATE saved_messages SET name = ? WHERE id = ?', [body.name, req.params.id]);
    if (body.kind !== undefined) await ctx.db.execute('UPDATE saved_messages SET kind = ? WHERE id = ?', [body.kind, req.params.id]);
    if (body.payload !== undefined) await ctx.db.execute('UPDATE saved_messages SET payload = ? WHERE id = ?', [JSON.stringify(body.payload), req.params.id]);
    res.json({ ok: true });
  });

  router.delete('/:id', async (req, res) => {
    await ctx.db.execute('DELETE FROM saved_messages WHERE id = ?', [req.params.id]);
    res.json({ ok: true });
  });

  router.post('/:id/send', async (req, res) => {
    const body = req.body as { channelId?: string; guildId?: string; mode?: string; targetMessageId?: string | null };
    if (!body.channelId || !body.guildId) {
      res.status(400).json({ error: 'channelId and guildId required' });
      return;
    }
    const [rows] = await ctx.db.query<RowDataPacket[]>(
      'SELECT id, guild_id FROM saved_messages WHERE id = ?',
      [req.params.id],
    );
    if (rows.length === 0) {
      res.status(404).json({ error: 'message template not found' });
      return;
    }
    const mode = body.mode === 'edit' ? 'edit' : 'send';
    const [result] = await ctx.db.execute(
      "INSERT INTO message_send_requests (saved_message_id, guild_id, channel_id, mode, target_message_id, status) VALUES (?, ?, ?, ?, ?, 'pending')",
      [req.params.id, body.guildId, body.channelId, mode, body.targetMessageId ?? null],
    );
    res.json({ requestId: (result as { insertId: number }).insertId });
  });

  router.get('/requests/:id', async (req, res) => {
    const [rows] = await ctx.db.query<RowDataPacket[]>(
      'SELECT id, saved_message_id, channel_id, mode, target_message_id, status, error, created_at, processed_at FROM message_send_requests WHERE id = ?',
      [req.params.id],
    );
    const row = rows[0];
    if (!row) {
      res.status(404).json({ error: 'not found' });
      return;
    }
    const rec = row as unknown as Record<string, unknown>;
    if (rec.status === 'done') {
      const [sent] = await ctx.db.query<RowDataPacket[]>(
        'SELECT message_id FROM sent_messages WHERE saved_message_id = ? ORDER BY id DESC LIMIT 1',
        [rec.saved_message_id],
      );
      rec.message_id = sent[0]?.message_id ?? null;
    }
    res.json({ request: rec });
  });

  return router;
}