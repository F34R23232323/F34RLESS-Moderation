import { parseJson } from '../../../shared/src/index';
import type { App } from '../core/context';
import type { RowDataPacket } from 'mysql2/promise';
import type { MessageSpec } from '../utils/messageBuilder';
import { buildMessagePayload, clientEmojiIds } from '../utils/messageBuilder';

export interface SavedMessageRow {
  id: number;
  guild_id: string;
  name: string;
  kind: 'v1' | 'v2';
  payload: string;
  created_by: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface SendResult {
  ok: boolean;
  messageId?: string;
  error?: string;
}

export class SavedMessageService {
  private readonly app: App;

  constructor(app: App) {
    this.app = app;
  }

  public async list(guildId: string): Promise<SavedMessageRow[]> {
    const [rows] = await this.app.db.query<RowDataPacket[]>(
      'SELECT * FROM saved_messages WHERE guild_id = ? ORDER BY updated_at DESC LIMIT 200',
      [guildId],
    );
    return rows as unknown as SavedMessageRow[];
  }

  public async get(id: number): Promise<SavedMessageRow | null> {
    const [rows] = await this.app.db.query<RowDataPacket[]>('SELECT * FROM saved_messages WHERE id = ?', [id]);
    return (rows[0] as unknown as SavedMessageRow) ?? null;
  }

  public async getByName(guildId: string, name: string): Promise<SavedMessageRow | null> {
    const [rows] = await this.app.db.query<RowDataPacket[]>(
      'SELECT * FROM saved_messages WHERE guild_id = ? AND name = ? ORDER BY updated_at DESC LIMIT 1',
      [guildId, name],
    );
    return (rows[0] as unknown as SavedMessageRow) ?? null;
  }

  public async create(guildId: string, name: string, kind: 'v1' | 'v2', payload: MessageSpec, createdBy?: string | null): Promise<number> {
    const [result] = await this.app.db.execute(
      'INSERT INTO saved_messages (guild_id, name, kind, payload, created_by) VALUES (?, ?, ?, ?, ?)',
      [guildId, name, kind, JSON.stringify(payload), createdBy ?? null],
    );
    return (result as { insertId: number }).insertId;
  }

  public async update(id: number, data: { name?: string; kind?: 'v1' | 'v2'; payload?: MessageSpec }): Promise<void> {
    if (data.name !== undefined) await this.app.db.execute('UPDATE saved_messages SET name = ? WHERE id = ?', [data.name, id]);
    if (data.kind !== undefined) await this.app.db.execute('UPDATE saved_messages SET kind = ? WHERE id = ?', [data.kind, id]);
    if (data.payload !== undefined) await this.app.db.execute('UPDATE saved_messages SET payload = ? WHERE id = ?', [JSON.stringify(data.payload), id]);
  }

  public async remove(id: number): Promise<void> {
    await this.app.db.execute('DELETE FROM saved_messages WHERE id = ?', [id]);
  }

  public parsePayload(row: SavedMessageRow): MessageSpec {
    return parseJson(row.payload, { kind: 'v1', content: '', embeds: [], components: [] }) as MessageSpec;
  }

  public async requestSend(
    savedMessageId: number,
    guildId: string,
    channelId: string,
    mode: 'send' | 'edit',
    targetMessageId?: string | null,
  ): Promise<number> {
    const [result] = await this.app.db.execute(
      'INSERT INTO message_send_requests (saved_message_id, guild_id, channel_id, mode, target_message_id, status) VALUES (?, ?, ?, ?, ?, \'pending\')',
      [savedMessageId, guildId, channelId, mode, targetMessageId ?? null],
    );
    return (result as { insertId: number }).insertId;
  }

  public async requestStatus(id: number): Promise<Record<string, unknown> | null> {
    const [rows] = await this.app.db.query<RowDataPacket[]>(
      'SELECT id, saved_message_id, channel_id, mode, status, error, created_at, processed_at FROM message_send_requests WHERE id = ?',
      [id],
    );
    const row = rows[0];
    if (!row) return null;
    const rec = row as unknown as Record<string, unknown>;
    if (rec.status === 'done' && rec.message_id === undefined) {
      const [sent] = await this.app.db.query<RowDataPacket[]>(
        'SELECT message_id FROM sent_messages WHERE saved_message_id = ? ORDER BY id DESC LIMIT 1',
        [rec.saved_message_id],
      );
      rec.message_id = sent[0]?.message_id ?? null;
    }
    return rec;
  }

  public async processPendingSends(): Promise<void> {
    const [rows] = await this.app.db.query<RowDataPacket[]>(
      "SELECT * FROM message_send_requests WHERE status = 'pending' ORDER BY id ASC LIMIT 20",
    );
    for (const raw of rows) {
      const req = raw as unknown as {
        id: number;
        saved_message_id: number;
        guild_id: string;
        channel_id: string;
        mode: string;
        target_message_id: string | null;
      };
      try {
        const saved = await this.get(req.saved_message_id);
        if (!saved) throw new Error('saved message not found');
        const spec = this.parsePayload(saved);
        const payload = buildMessagePayload(spec, String(saved.id), clientEmojiIds(this.app.client));

        const guild = this.app.client.guilds.cache.get(req.guild_id);
        if (!guild) throw new Error('guild not cached');
        const channel = guild.channels.cache.get(req.channel_id);
        if (!channel || !('send' in channel)) throw new Error('channel not found');

        let messageId: string;
        if (req.mode === 'edit') {
          const existing = await (channel as { messages: { fetch: (id: string) => Promise<{ edit: (p: unknown) => Promise<{ id: string }> }> } }).messages.fetch(req.target_message_id!);
          const edited = await existing.edit({ ...payload, allowedMentions: { parse: [] } } as never);
          messageId = edited.id;
        } else {
          const sent = await channel.send({ ...payload, allowedMentions: { parse: [] } } as never);
          messageId = sent.id;
        }

        await this.app.db.execute(
          'INSERT INTO sent_messages (saved_message_id, guild_id, channel_id, message_id) VALUES (?, ?, ?, ?)',
          [req.saved_message_id, req.guild_id, req.channel_id, messageId],
        );
        await this.app.db.execute(
          "UPDATE message_send_requests SET status = 'done', processed_at = NOW() WHERE id = ?",
          [req.id],
        );
      } catch (err) {
        await this.app.db.execute(
          "UPDATE message_send_requests SET status = 'failed', error = ?, processed_at = NOW() WHERE id = ?",
          [(err as Error).message.slice(0, 1000), req.id],
        );
      }
    }
  }

public async syncChannels(): Promise<void> {
    for (const guild of this.app.client.guilds.cache.values()) {
      const channels = guild.channels.cache.filter((c) => ('send' in c || c.isTextBased()) || c.type === 4);
      for (const ch of channels.values()) {
        await this.app.db.execute(
          `INSERT INTO guild_channels (id, guild_id, name, type, parent_id, position) VALUES (?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE name = VALUES(name), type = VALUES(type), parent_id = VALUES(parent_id), position = VALUES(position)`,
          [ch.id, guild.id, ch.name, ch.type, ch.parentId ?? null, (ch as unknown as { rawPosition?: number }).rawPosition ?? 0],
        );
      }
    }
  }

  public async syncRoles(): Promise<void> {
    for (const guild of this.app.client.guilds.cache.values()) {
      for (const role of guild.roles.cache.values()) {
        await this.app.db.execute(
          `INSERT INTO guild_roles (id, guild_id, name, color, position, hoist, managed) VALUES (?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE name = VALUES(name), color = VALUES(color), position = VALUES(position), hoist = VALUES(hoist), managed = VALUES(managed)`,
          [role.id, guild.id, role.name, role.color ?? 0, role.position ?? 0, role.hoist ? 1 : 0, role.managed ? 1 : 0],
        );
      }
    }
  }
}