import { Router } from 'express';
import type { RowDataPacket } from 'mysql2/promise';
import type { DashboardContext } from '../context';

export function createMessageLogRouter(ctx: DashboardContext): Router {
  const router = Router();

  router.get('/filters', async (_req, res) => {
    const [guildRows] = await ctx.db.query<RowDataPacket[]>(
      'SELECT guild_id, COUNT(*) AS count FROM message_snapshots GROUP BY guild_id ORDER BY count DESC LIMIT 100',
    );
    const [userRows] = await ctx.db.query<RowDataPacket[]>(
      'SELECT guild_id, user_id, username, display_name FROM guild_users ORDER BY display_name, username LIMIT 2000',
    );
    const [channelRows] = await ctx.db.query<RowDataPacket[]>(
      'SELECT id, guild_id, name FROM guild_channels ORDER BY name LIMIT 2000',
    );
    res.json({
      guilds: guildRows.map((g) => ({
        value: String(g.guild_id),
        label: `${String(g.guild_id)} (${g.count})`,
        keywords: `${g.guild_id} ${g.count}`,
      })),
      users: userRows.map((u) => {
        const name = u.display_name || u.username;
        return {
          value: String(u.user_id),
          label: `${name} (${u.user_id})`,
          keywords: `${u.username} ${u.display_name ?? ''} ${u.user_id}`,
          guildId: String(u.guild_id),
        };
      }),
      channels: channelRows.map((c) => ({
        value: String(c.id),
        label: `#${c.name}`,
        keywords: `${c.name} ${c.id}`,
        guildId: String(c.guild_id),
      })),
    });
  });

  router.get('/', async (req, res) => {
    const { guild, user, channel, q, kind, limit = 100, offset = 0 } = req.query as Record<string, string | undefined>;
    const where: string[] = [];
    const params: unknown[] = [];
    if (guild) {
      where.push('guild_id = ?');
      params.push(guild);
    }
    if (user) {
      where.push('author_id = ?');
      params.push(user);
    }
    if (channel) {
      where.push('channel_id = ?');
      params.push(channel);
    }
    if (kind === 'deleted') {
      where.push('deleted_at IS NOT NULL');
    } else if (kind === 'edited') {
      where.push('edit_count > 0');
    } else if (kind === 'active') {
      where.push('deleted_at IS NULL');
    } else if (kind === 'normal') {
      where.push('deleted_at IS NULL AND edit_count = 0');
    }
    if (q) {
      where.push('content LIKE ?');
      params.push(`%${q}%`);
    }
    const whereSql = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
    const [rows] = await ctx.db.query<RowDataPacket[]>(
      `SELECT id, guild_id, channel_id, message_id, author_id, author_username, author_nickname, author_is_bot, content, edit_count, created_at, updated_at, deleted_at, captured_at
       FROM message_snapshots ${whereSql} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [...params, Number(limit), Number(offset)],
    );
    const [countRows] = await ctx.db.query<RowDataPacket[]>(`SELECT COUNT(*) AS count FROM message_snapshots ${whereSql}`, params);
    res.json({ rows, total: Number(countRows[0]?.count ?? 0) });
  });

  router.get('/:id', async (req, res) => {
    const [rows] = await ctx.db.query<RowDataPacket[]>(
      `SELECT id, guild_id, channel_id, message_id, author_id, author_username, author_nickname, author_avatar, author_is_bot, content, embeds, components, stickers, referenced_message, attachments, edits, edit_count, created_at, updated_at, deleted_at, captured_at
       FROM message_snapshots WHERE id = ?`,
      [req.params.id],
    );
    const row = rows[0];
    if (!row) {
      res.status(404).json({ error: 'message not found' });
      return;
    }
    const parse = (v: unknown, fb: unknown) => {
      if (v == null) return fb;
      try {
        return JSON.parse(String(v));
      } catch {
        return fb;
      }
    };
    res.json({
      ...row,
      embeds: parse(row.embeds, []),
      components: parse(row.components, []),
      stickers: parse(row.stickers, []),
      referenced_message: parse(row.referenced_message, null),
      attachments: parse(row.attachments, []),
      edits: parse(row.edits, []),
    });
  });

  router.delete('/:id', async (req, res) => {
    await ctx.db.execute('DELETE FROM message_snapshots WHERE id = ?', [req.params.id]);
    res.json({ ok: true });
  });

  router.post('/clear', async (req, res) => {
    const { guild } = req.body as { guild?: string };
    const [result] = guild
      ? await ctx.db.execute('DELETE FROM message_snapshots WHERE guild_id = ?', [guild])
      : await ctx.db.execute('DELETE FROM message_snapshots');
    res.json({ ok: true, removed: (result as { affectedRows?: number }).affectedRows ?? 0 });
  });

  router.post('/purge', async (req, res) => {
    const { days, guild } = req.body as { days?: number; guild?: string };
    const retention = Math.max(1, Math.min(365, days ?? 90));
    const cutoff = new Date(Date.now() - retention * 86400000);
    const [result] = guild
      ? await ctx.db.execute('DELETE FROM message_snapshots WHERE guild_id = ? AND captured_at < ?', [guild, cutoff])
      : await ctx.db.execute('DELETE FROM message_snapshots WHERE captured_at < ?', [cutoff]);
    res.json({ ok: true, removed: (result as { affectedRows?: number }).affectedRows ?? 0 });
  });

  return router;
}
