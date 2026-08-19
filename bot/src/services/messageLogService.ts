import type { GuildMember, Message, PartialMessage, User } from 'discord.js';
import type { RowDataPacket } from 'mysql2/promise';
import { parseJson } from '../../../shared/src/index';
import type { App } from '../core/context';
import { serializeMessageRecord, type SerializedMessage } from '../utils/messageSerialization';

const MAX_EDITS_KEPT = 25;
const CACHE_TTL_MS = 24 * 3600_000;
const CACHE_MAX = 20_000;
const USER_UPSERT_THROTTLE_MS = 30 * 60_000;
const FLUSH_INTERVAL_MS = 15_000;
const FLUSH_MAX = 150;
const BULK_INSERT_BATCH = 50;

export class MessageLogService {
  private readonly app: App;

  // Full message data (all messages, kept briefly in memory).
  private readonly memCache = new Map<string, SerializedMessage>();
  private readonly lastUpsert = new Map<string, number>();

  // Batched work queues (flushed on an interval + when they grow too large).
  private readonly pendingCreate = new Map<string, { guildId: string; record: SerializedMessage }>();
  private readonly pendingDeletes = new Map<string, { guildId: string; record: SerializedMessage; at: Date }>();
  private readonly pendingEdits = new Map<string, { guildId: string; before: SerializedMessage; after: SerializedMessage; at: Date }>();
  private readonly timer: NodeJS.Timeout;

  constructor(app: App) {
    this.app = app;
    this.timer = setInterval(() => {
      void this.flush().catch((err) => this.app.logger.warn('MessageLogService.flush failed:', err));
    }, FLUSH_INTERVAL_MS);
    this.timer.unref?.();
  }

  public get enabled(): boolean {
    return this.app.config.archives.snapshot_messages;
  }

  public async upsertUser(guildId: string | null, user: User, member?: GuildMember | null): Promise<void> {
    if (!guildId) return;
    const displayName = member && 'displayName' in member ? String(member.displayName).slice(0, 128) : null;
    await this.app.db
      .execute(
        `INSERT INTO guild_users (guild_id, user_id, username, display_name, avatar, is_bot)
         VALUES (?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE username = VALUES(username), display_name = VALUES(display_name), avatar = VALUES(avatar), is_bot = VALUES(is_bot)`,
        [guildId, user.id, user.username, displayName, user.displayAvatarURL({ size: 128, extension: 'png' }), user.bot ? 1 : 0],
      )
      .catch(() => undefined);
  }

  /** Called on every message: queues a snapshot for the next bulk insert (no per-message DB write). */
  public async capture(message: Message): Promise<void> {
    if (!this.enabled || !message.inGuild()) return;
    try {
      const rec = await serializeMessageRecord(message, { skipReference: true });
      if (this.memCache.size >= CACHE_MAX) this.pruneCache();
      this.memCache.set(message.id, rec);
      this.pendingCreate.set(message.id, { guildId: message.guildId, record: rec });
      await this.maybeUpsertUser(message.guildId, message.author, message.member);
      if (this.pendingCreate.size >= FLUSH_MAX) await this.flushCreate();
    } catch (err) {
      this.app.logger.warn('MessageLogService.capture failed:', err);
    }
  }

  public async onMessageEdit(before: Message | PartialMessage, after: Message | PartialMessage): Promise<void> {
    if (!this.enabled || !after.guildId) return;
    try {
      const afterRec: SerializedMessage | null =
        (after.author ? await serializeMessageRecord(after as Message).catch(() => null) : null) ??
        this.recordFromMemory(after.id) ??
        (await this.recordFromDb(after.guildId, after.channelId, after.id));
      if (!afterRec) return;
      const beforeRec: SerializedMessage =
        (before.author ? await serializeMessageRecord(before as Message).catch(() => null) : null) ??
        this.recordFromMemory(after.id) ??
        afterRec;

      this.pendingCreate.delete(after.id);
      this.memCache.set(after.id, afterRec);
      this.pendingEdits.set(after.id, { guildId: after.guildId, before: beforeRec, after: afterRec, at: new Date() });
      if (this.pendingEdits.size >= FLUSH_MAX) await this.flushEdits();
    } catch (err) {
      this.app.logger.warn('MessageLogService.onMessageEdit failed:', err);
    }
  }

  public async onMessageDelete(message: Message | PartialMessage): Promise<void> {
    if (!this.enabled || !message.guildId) return;
    try {
      const rec: SerializedMessage | null =
        (message.author ? await serializeMessageRecord(message as Message).catch(() => null) : null) ??
        this.recordFromMemory(message.id) ??
        (await this.recordFromDb(message.guildId, message.channelId, message.id));

      this.pendingCreate.delete(message.id);
      this.memCache.delete(message.id);
      if (rec) {
        this.pendingDeletes.set(message.id, { guildId: message.guildId, record: rec, at: new Date() });
      } else {
        await this.app.db
          .execute('UPDATE message_snapshots SET deleted_at = NOW() WHERE message_id = ?', [message.id])
          .catch(() => undefined);
      }
      if (this.pendingDeletes.size >= FLUSH_MAX) await this.flushDeletes();
    } catch (err) {
      this.app.logger.warn('MessageLogService.onMessageDelete failed:', err);
    }
  }

  public async markBulkDeleted(messageIds: string[]): Promise<void> {
    if (!this.enabled || messageIds.length === 0) return;
    try {
      const ids = [...new Set(messageIds)];
      const placeholders = ids.map(() => '?').join(',');
      await this.app.db.execute(`UPDATE message_snapshots SET deleted_at = NOW() WHERE message_id IN (${placeholders})`, ids);
    } catch (err) {
      this.app.logger.warn('MessageLogService.markBulkDeleted failed:', err);
    }
  }

  public async purgeOld(): Promise<number> {
    if (!this.enabled) return 0;
    const cutoff = new Date(Date.now() - this.app.config.archives.message_retention_days * 86400000);
    const [res] = await this.app.db.execute('DELETE FROM message_snapshots WHERE captured_at < ?', [cutoff]);
    return (res as { affectedRows?: number }).affectedRows ?? 0;
  }

  /** Flush all pending queues (called on an interval and when a queue grows too large). */
  public async flush(): Promise<void> {
    await this.flushCreate();
    await this.flushDeletes();
    await this.flushEdits();
  }

  private async flushCreate(): Promise<void> {
    if (this.pendingCreate.size === 0) return;
    const items = [...this.pendingCreate.values()];
    this.pendingCreate.clear();
    try {
      for (let i = 0; i < items.length; i += BULK_INSERT_BATCH) {
        const batch = items.slice(i, i + BULK_INSERT_BATCH);
        const placeholders = batch.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').join(',');
        const values: any[] = [];
        for (const { guildId, record } of batch) {
          values.push(
            guildId,
            record.channelId,
            record.messageId,
            record.authorId,
            record.authorUsername,
            record.authorNickname,
            record.authorAvatar,
            record.authorIsBot ? 1 : 0,
            record.content || null,
            JSON.stringify(record.embeds),
            JSON.stringify(record.components),
            JSON.stringify(record.stickers),
            JSON.stringify(record.referencedMessage),
            JSON.stringify(record.attachments),
            new Date(record.createdAt),
          );
        }
        await this.app.db.execute(
          `INSERT IGNORE INTO message_snapshots
            (guild_id, channel_id, message_id, author_id, author_username, author_nickname, author_avatar, author_is_bot, content, embeds, components, stickers, referenced_message, attachments, created_at)
           VALUES ${placeholders}`,
          values,
        );
      }
    } catch (err) {
      this.app.logger.warn('MessageLogService.flushCreate failed:', err);
    }
  }

  private async flushDeletes(): Promise<void> {
    if (this.pendingDeletes.size === 0) return;
    const items = [...this.pendingDeletes.values()];
    this.pendingDeletes.clear();
    try {
      const byGuild = new Map<string, typeof items>();
      for (const it of items) {
        const arr = byGuild.get(it.guildId) ?? [];
        arr.push(it);
        byGuild.set(it.guildId, arr);
      }
      for (const [guildId, list] of byGuild) {
        for (const it of list) {
          await this.writeSnapshot(it.guildId, it.record, { deletedAt: it.at }).catch(() => undefined);
        }
        await this.app.archives.archiveBatch({
          guildId,
          channelId: null,
          records: list.map((i) => i.record),
          kind: 'deleted_message',
          title: `${list.length} deleted message(s)`,
          reason: 'batch of deleted messages',
        });
      }
    } catch (err) {
      this.app.logger.warn('MessageLogService.flushDeletes failed:', err);
    }
  }

  private async flushEdits(): Promise<void> {
    if (this.pendingEdits.size === 0) return;
    const items = [...this.pendingEdits.values()];
    this.pendingEdits.clear();
    try {
      const byGuild = new Map<string, typeof items>();
      for (const it of items) {
        const arr = byGuild.get(it.guildId) ?? [];
        arr.push(it);
        byGuild.set(it.guildId, arr);
      }
      for (const [guildId, list] of byGuild) {
        for (const it of list) {
          const [rows] = await this.app.db.query<RowDataPacket[]>(
            'SELECT edits FROM message_snapshots WHERE message_id = ?',
            [it.after.messageId],
          );
          const edits: Array<{ content: string | null; at: string }> = rows[0] ? parseJson(rows[0].edits, []) : [];
          edits.push({ content: it.before.content, at: it.at.toISOString() });
          await this.writeSnapshot(guildId, it.after, { edits: edits.slice(-MAX_EDITS_KEPT) }).catch(() => undefined);
        }
        const records: SerializedMessage[] = [];
        for (const it of list) records.push(it.before, it.after);
        await this.app.archives.archiveBatch({
          guildId,
          channelId: null,
          records,
          kind: 'edited_message',
          title: `${list.length} edited message(s)`,
          reason: 'batch of edited messages',
        });
      }
    } catch (err) {
      this.app.logger.warn('MessageLogService.flushEdits failed:', err);
    }
  }

  private async maybeUpsertUser(guildId: string, user: User, member?: GuildMember | null): Promise<void> {
    const key = `${guildId}:${user.id}`;
    const last = this.lastUpsert.get(key) ?? 0;
    if (Date.now() - last < USER_UPSERT_THROTTLE_MS) return;
    this.lastUpsert.set(key, Date.now());
    await this.upsertUser(guildId, user, member);
  }

  private pruneCache(): void {
    const cutoff = Date.now() - CACHE_TTL_MS;
    for (const [key, rec] of this.memCache) {
      if (rec.createdAt < cutoff) this.memCache.delete(key);
    }
  }

  private recordFromMemory(messageId: string): SerializedMessage | null {
    const rec = this.memCache.get(messageId);
    if (!rec) return null;
    if (Date.now() - rec.createdAt > CACHE_TTL_MS) {
      this.memCache.delete(messageId);
      return null;
    }
    return rec;
  }

  private async recordFromDb(guildId: string, channelId: string, messageId: string): Promise<SerializedMessage | null> {
    const [rows] = await this.app.db.query<RowDataPacket[]>(
      `SELECT author_id, author_username, author_nickname, author_avatar, author_is_bot, content, embeds, components, stickers, referenced_message, attachments, created_at
       FROM message_snapshots WHERE guild_id = ? AND message_id = ?`,
      [guildId, messageId],
    );
    const row = rows[0];
    if (!row) return null;
    return {
      messageId,
      channelId,
      authorId: String(row.author_id),
      authorUsername: String(row.author_username),
      authorNickname: row.author_nickname ? String(row.author_nickname) : null,
      authorAvatar: row.author_avatar ? String(row.author_avatar) : '',
      authorIsBot: Number(row.author_is_bot) === 1,
      content: row.content ? String(row.content) : '',
      embeds: parseJson(row.embeds, []),
      components: parseJson(row.components, []),
      stickers: parseJson(row.stickers, []),
      referencedMessage: row.referenced_message ? parseJson(row.referenced_message, null) : null,
      attachments: parseJson(row.attachments, []),
      createdAt: new Date(row.created_at).getTime(),
    };
  }

  private async writeSnapshot(
    guildId: string,
    rec: SerializedMessage,
    opts: { edits?: Array<{ content: string | null; at: string }>; deletedAt?: Date } = {},
  ): Promise<void> {
    const base: Array<string | number | Date | null> = [
      rec.channelId,
      rec.messageId,
      rec.authorId,
      rec.authorUsername,
      rec.authorNickname,
      rec.authorAvatar,
      rec.authorIsBot ? 1 : 0,
      rec.content || null,
      JSON.stringify(rec.embeds),
      JSON.stringify(rec.components),
      JSON.stringify(rec.stickers),
      JSON.stringify(rec.referencedMessage),
      JSON.stringify(rec.attachments),
      new Date(rec.createdAt),
    ];

    if (opts.edits) {
      await this.app.db.execute(
        `INSERT INTO message_snapshots
          (guild_id, channel_id, message_id, author_id, author_username, author_nickname, author_avatar, author_is_bot, content, embeds, components, stickers, referenced_message, attachments, edits, edit_count, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, NOW())
         ON DUPLICATE KEY UPDATE
          content = VALUES(content),
          embeds = VALUES(embeds),
          components = VALUES(components),
          stickers = VALUES(stickers),
          attachments = VALUES(attachments),
          referenced_message = VALUES(referenced_message),
          edits = VALUES(edits),
          edit_count = edit_count + 1,
          updated_at = NOW()`,
        [guildId, ...base, JSON.stringify(opts.edits)],
      );
    } else {
      await this.app.db.execute(
        `INSERT INTO message_snapshots
          (guild_id, channel_id, message_id, author_id, author_username, author_nickname, author_avatar, author_is_bot, content, embeds, components, stickers, referenced_message, attachments, edit_count, created_at, deleted_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
         ON DUPLICATE KEY UPDATE
          content = VALUES(content),
          embeds = VALUES(embeds),
          components = VALUES(components),
          stickers = VALUES(stickers),
          attachments = VALUES(attachments),
          referenced_message = VALUES(referenced_message),
          deleted_at = NOW()`,
        [guildId, ...base, opts.deletedAt ?? null],
      );
    }
  }
}
