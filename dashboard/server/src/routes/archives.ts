import { Router } from 'express';
import type { RowDataPacket } from 'mysql2/promise';
import type { DashboardContext } from '../context';

interface MediaRow extends RowDataPacket {
  id: number;
  archive_id: number;
  archive_message_id: number | null;
  author_id: string | null;
  kind: string;
  name: string | null;
  content_type: string | null;
  size: number;
  width: number | null;
  height: number | null;
  original_url: string | null;
}

function mediaUrl(id: number): string {
  return `/api/archive/media/${id}`;
}

export function createArchivesRouter(ctx: DashboardContext): Router {
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
    const { guild, q, kind, limit = 100, offset = 0 } = req.query as Record<string, string | undefined>;
    const where: string[] = [];
    const params: unknown[] = [];
    if (guild) {
      where.push('guild_id = ?');
      params.push(guild);
    }
    if (kind) {
      where.push('kind = ?');
      params.push(kind);
    }
    if (q) {
      where.push('(code LIKE ? OR title LIKE ? OR reason LIKE ?)');
      params.push(`%${q}%`, `%${q}%`, `%${q}%`);
    }
    const whereSql = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
    const [rows] = await ctx.db.query<RowDataPacket[]>(
      `SELECT id, code, guild_id, channel_id, filter_user_id, kind, title, reason, created_by, case_id, automod_log_id, message_count, media_count, total_bytes, created_at
       FROM archives ${whereSql} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [...params, Number(limit), Number(offset)],
    );
    const [countRows] = await ctx.db.query<RowDataPacket[]>(`SELECT COUNT(*) AS count FROM archives ${whereSql}`, params);
    res.json({ rows, total: Number(countRows[0]?.count ?? 0) });
  });

  router.get('/:code', async (req, res) => {
    const [a] = await ctx.db.query<RowDataPacket[]>(
      'SELECT id, code, guild_id, channel_id, filter_user_id, kind, title, reason, created_by, case_id, automod_log_id, message_count, media_count, total_bytes, created_at FROM archives WHERE code = ?',
      [req.params.code],
    );
    const archive = a[0];
    if (!archive) {
      res.status(404).json({ error: 'archive not found' });
      return;
    }
    const [messages] = await ctx.db.query<RowDataPacket[]>(
      `SELECT id, archive_id, message_id, channel_id, author_id, author_username, author_nickname, author_avatar, author_is_bot, content, embeds, components, stickers, referenced_message, created_at, position, status
       FROM archive_messages WHERE archive_id = ? ORDER BY position ASC`,
      [archive.id],
    );
    const [mediaRows] = await ctx.db.query<MediaRow[]>(
      'SELECT id, archive_id, archive_message_id, author_id, kind, name, content_type, size, width, height, original_url FROM archive_media WHERE archive_id = ? ORDER BY id ASC',
      [archive.id],
    );
    const media = mediaRows.map((m) => ({
      id: m.id,
      archiveMessageId: m.archive_message_id,
      authorId: m.author_id,
      kind: m.kind,
      name: m.name,
      contentType: m.content_type,
      size: m.size,
      width: m.width,
      height: m.height,
      originalUrl: m.original_url,
      url: mediaUrl(m.id),
    }));
    res.json({ archive, messages, media });
  });

  router.patch('/:code', async (req, res) => {
    const body = req.body as { title?: string | null; reason?: string | null };
    const [a] = await ctx.db.query<RowDataPacket[]>('SELECT id, guild_id FROM archives WHERE code = ?', [req.params.code]);
    if (!a[0]) {
      res.status(404).json({ error: 'archive not found' });
      return;
    }
    const details: Record<string, unknown> = {};
    if (body.title !== undefined) {
      await ctx.db.execute('UPDATE archives SET title = ? WHERE id = ?', [body.title ?? null, a[0].id]);
      details.title = body.title;
    }
    if (body.reason !== undefined) {
      await ctx.db.execute('UPDATE archives SET reason = ? WHERE id = ?', [body.reason ?? null, a[0].id]);
      details.reason = body.reason;
    }
    if (Object.keys(details).length > 0) {
      await queueLog({
        guildId: String(a[0].guild_id),
        event: 'archive_edit',
        actorId: (req as unknown as { userId?: string }).userId ?? null,
        message: `Archive ${req.params.code} edited from the dashboard`,
        details,
      });
    }
    res.json({ ok: true });
  });

  router.delete('/:code', async (req, res) => {
    const [a] = await ctx.db.query<RowDataPacket[]>('SELECT id, guild_id, message_count FROM archives WHERE code = ?', [req.params.code]);
    if (!a[0]) {
      res.status(404).json({ error: 'archive not found' });
      return;
    }
    await ctx.db.execute('DELETE FROM archives WHERE id = ?', [a[0].id]);
    await queueLog({
      guildId: String(a[0].guild_id),
      event: 'archive_delete',
      actorId: (req as unknown as { userId?: string }).userId ?? null,
      message: `Archive ${req.params.code} deleted from the dashboard (${a[0].message_count} messages)`,
    });
    res.json({ ok: true });
  });

  router.delete('/:code/media/:mediaId', async (req, res) => {
    const [a] = await ctx.db.query<RowDataPacket[]>(
      'SELECT a.id, a.guild_id FROM archives a JOIN archive_media m ON m.archive_id = a.id WHERE a.code = ? AND m.id = ?',
      [req.params.code, req.params.mediaId],
    );
    if (!a[0]) {
      res.status(404).json({ error: 'media not found' });
      return;
    }
    await ctx.db.execute('DELETE FROM archive_media WHERE id = ?', [req.params.mediaId]);
    const [stats] = await ctx.db.query<RowDataPacket[]>(
      'SELECT COUNT(*) AS media_count, COALESCE(SUM(size), 0) AS total_bytes FROM archive_media WHERE archive_id = ?',
      [a[0].id],
    );
    await ctx.db.execute('UPDATE archives SET media_count = ?, total_bytes = ? WHERE id = ?', [
      Number(stats[0]?.media_count ?? 0),
      Number(stats[0]?.total_bytes ?? 0),
      a[0].id,
    ]);
    await queueLog({
      guildId: String(a[0].guild_id),
      event: 'archive_media_delete',
      actorId: (req as unknown as { userId?: string }).userId ?? null,
      message: `Media #${req.params.mediaId} removed from archive ${req.params.code} from the dashboard`,
    });
    res.json({ ok: true });
  });

  router.get('/:code/export', async (req, res) => {
    const [a] = await ctx.db.query<RowDataPacket[]>(
      'SELECT id, code, guild_id, channel_id, filter_user_id, kind, title, reason, created_by, case_id, automod_log_id, message_count, media_count, total_bytes, created_at FROM archives WHERE code = ?',
      [req.params.code],
    );
    const archive = a[0];
    if (!archive) {
      res.status(404).json({ error: 'archive not found' });
      return;
    }
    const [messages] = await ctx.db.query<RowDataPacket[]>(
      `SELECT id, message_id, channel_id, author_id, author_username, author_nickname, author_avatar, author_is_bot, content, embeds, components, stickers, referenced_message, created_at, position, status
       FROM archive_messages WHERE archive_id = ? ORDER BY position ASC`,
      [archive.id],
    );
    const [mediaRows] = await ctx.db.query<MediaRow[]>(
      'SELECT id, archive_message_id, author_id, kind, name, content_type, size, width, height, original_url FROM archive_media WHERE archive_id = ? ORDER BY id ASC',
      [archive.id],
    );
    const media = mediaRows.map((m) => ({
      id: m.id,
      archiveMessageId: m.archive_message_id,
      authorId: m.author_id,
      kind: m.kind,
      name: m.name,
      contentType: m.content_type,
      size: m.size,
      width: m.width,
      height: m.height,
      originalUrl: m.original_url,
      url: mediaUrl(m.id),
    }));
    const snapshot = { archive, messages, media, exportedAt: new Date().toISOString() };
    res.setHeader('Content-Disposition', `attachment; filename="archive-${archive.code}.json"`);
    res.setHeader('Content-Type', 'application/json');
    res.send(JSON.stringify(snapshot, null, 2));
  });

  return router;
}
