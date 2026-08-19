import { Router } from 'express';
import type { RowDataPacket } from 'mysql2/promise';
import type { DashboardContext } from '../context';
import { buildTranscriptHtml } from '../utils/transcript';

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
  data: Buffer;
}

function mediaUrl(id: number): string {
  return `/api/archive/media/${id}`;
}

const INLINE_KINDS = new Set(['image', 'gif', 'video', 'audio']);

export function createArchivePublicRouter(ctx: DashboardContext): Router {
  const router = Router();

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
      `SELECT id, archive_id, message_id, channel_id, author_id, author_username, author_nickname, author_avatar, author_is_bot, content, embeds, components, stickers, referenced_message, created_at, position
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

  router.get('/media/:id', async (req, res) => {
    const [rows] = await ctx.db.query<MediaRow[]>(
      'SELECT id, archive_id, kind, name, content_type, size, data FROM archive_media WHERE id = ?',
      [req.params.id],
    );
    const row = rows[0];
    if (!row || !row.data || row.data.length === 0) {
      res.status(404).json({ error: 'media not found' });
      return;
    }
    const contentType = row.content_type || 'application/octet-stream';
    const inline = INLINE_KINDS.has(row.kind);
    const safeName = (row.name ?? 'attachment').replace(/[^\w.\- ]+/g, '_');
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Length', row.data.length);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    if (inline) {
      res.setHeader('Content-Disposition', `inline; filename="${safeName}"`);
    } else {
      res.setHeader('Content-Disposition', `attachment; filename="${safeName}"`);
    }
    res.end(row.data);
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
      `SELECT id, message_id, channel_id, author_id, author_username, author_nickname, author_avatar, author_is_bot, content, embeds, components, stickers, referenced_message, created_at, position
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

  router.get('/:code/transcript', async (req, res) => {
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
      `SELECT id, message_id, channel_id, author_id, author_username, author_nickname, author_avatar, author_is_bot, content, embeds, components, stickers, referenced_message, created_at, position
       FROM archive_messages WHERE archive_id = ? ORDER BY position ASC`,
      [archive.id],
    );
    const [mediaRows] = await ctx.db.query<MediaRow[]>(
      'SELECT id, archive_message_id, author_id, kind, name, content_type, size, width, height, original_url FROM archive_media WHERE archive_id = ? ORDER BY id ASC',
      [archive.id],
    );
    const base = ctx.baseUrl.replace(/\/+$/, '');
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
      url: `/api/archive/media/${m.id}`,
    }));
    const html = buildTranscriptHtml(archive, messages as never, media as never, base);
    res.setHeader('Content-Disposition', `attachment; filename="archive-${archive.code}.html"`);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  });

  return router;
}
