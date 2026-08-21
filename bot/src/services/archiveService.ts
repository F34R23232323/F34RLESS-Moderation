import type { Guild, Message, TextBasedChannel } from 'discord.js';
import type { RowDataPacket } from 'mysql2/promise';
import { generateArchiveCode } from '../../../shared/src/index';
import type { App } from '../core/context';
import { serializeMessageRecord, type SerializedMessage, type StoredEmbed } from '../utils/messageSerialization';

export type ArchiveKind = 'manual' | 'case_evidence' | 'automod_evidence' | 'deleted_message' | 'edited_message' | 'message_activity';

export type ArchiveMessageStatus = 'deleted' | 'edited_before' | 'edited_after';

export interface ArchiveRecordInput {
  record: SerializedMessage;
  status?: ArchiveMessageStatus | null;
}

export type ArchiveRecordList = Array<SerializedMessage | ArchiveRecordInput>;

export interface ArchiveRow extends RowDataPacket {
  id: number;
  code: string;
  guild_id: string;
  channel_id: string | null;
  filter_user_id: string | null;
  kind: string;
  title: string | null;
  reason: string | null;
  created_by: string | null;
  case_id: number | null;
  automod_log_id: number | null;
  message_count: number;
  media_count: number;
  total_bytes: number;
  created_at: Date;
}

export interface ArchiveResult {
  id: number;
  code: string;
  link: string;
  messageCount: number;
}

export interface ArchiveChannelOptions {
  guild: Guild;
  channel: TextBasedChannel;
  amount: number;
  userId?: string | null;
  createdBy?: string | null;
  title?: string | null;
  reason?: string | null;
  kind?: ArchiveKind;
  caseId?: number | null;
}

export interface ArchiveContextOptions {
  guild: Guild;
  channel: TextBasedChannel;
  messageId: string;
  amount: number;
  createdBy?: string | null;
  reason?: string | null;
  kind?: ArchiveKind;
}

interface DownloadedMedia {
  buffer: Buffer;
  contentType: string | null;
}

const MEDIA_DOWNLOAD_TIMEOUT_MS = 15_000;

function hashId(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (Math.imul(31, h) + id.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function authorColorHex(authorId: string): string {
  const hue = hashId(authorId) % 360;
  return `hsl(${hue}, 70%, 60%)`;
}

export class ArchiveService {
  private readonly app: App;

  constructor(app: App) {
    this.app = app;
  }

  public get enabled(): boolean {
    return this.app.config.archives.enabled;
  }

  public getPublicLink(code: string): string {
    const base = this.app.env.DASHBOARD_BASE_URL || 'http://localhost:4693';
    return `${base.replace(/\/+$/, '')}/archive/${code}`;
  }

  public async archiveChannel(opts: ArchiveChannelOptions): Promise<ArchiveResult | null> {
    const messages = await this.collectMessages(opts.channel, opts.amount, opts.userId ?? null, null);
    if (messages.length === 0) return null;
    const records = [];
    for (const m of messages) records.push(await serializeMessageRecord(m));
    return this.createArchiveFromRecords(opts.guild, opts.channel.id, records, {
      kind: opts.kind ?? 'manual',
      userId: opts.userId ?? null,
      createdBy: opts.createdBy ?? null,
      title: opts.title ?? null,
      reason: opts.reason ?? null,
      caseId: opts.caseId ?? null,
    });
  }

  public async archiveContext(opts: ArchiveContextOptions): Promise<ArchiveResult | null> {
    const messages = await this.collectAround(opts.channel, opts.messageId, opts.amount);
    if (messages.length === 0) return null;
    const records = [];
    for (const m of messages) records.push(await serializeMessageRecord(m));
    return this.createArchiveFromRecords(opts.guild, opts.channel.id, records, {
      kind: opts.kind ?? 'automod_evidence',
      userId: null,
      createdBy: opts.createdBy ?? null,
      title: null,
      reason: opts.reason ?? null,
      caseId: null,
    });
  }

  public async archiveForCase(opts: {
    guild: Guild;
    userId: string;
    channelId?: string | null;
    amount?: number;
    createdBy?: string | null;
    caseId?: number;
    reason?: string | null;
    type: string;
  }): Promise<ArchiveResult | null> {
    const amount = opts.amount ?? this.app.config.archives.case_evidence_amount;
    const channel = await this.findUserRecentChannel(opts.guild, opts.userId, opts.channelId ?? null);
    if (!channel) return null;
    const messages = await this.collectMessages(channel, amount, opts.userId, null);
    if (messages.length === 0) return null;
    const records = [];
    for (const m of messages) records.push(await serializeMessageRecord(m));
    return this.createArchiveFromRecords(opts.guild, channel.id, records, {
      kind: 'case_evidence',
      userId: opts.userId,
      createdBy: opts.createdBy ?? null,
      title: `${opts.type} — case evidence`,
      reason: opts.reason ?? null,
      caseId: opts.caseId ?? null,
    });
  }

  public async archiveDeletedMessage(opts: {
    guild?: Guild | null;
    guildId: string;
    channelId: string;
    messageId: string;
    message?: Message | null;
    createdBy?: string | null;
    reason?: string | null;
  }): Promise<ArchiveResult | null> {
    if (!this.enabled || !this.app.config.archives.archive_on_delete) return null;
    const guild = opts.guild ?? this.app.client.guilds.cache.get(opts.guildId);
    if (!guild) return null;
    try {
      let record: SerializedMessage | null = null;
      if (opts.message && opts.message.author) {
        record = await serializeMessageRecord(opts.message);
      } else {
        record = await this.recordFromSnapshot(opts.guildId, opts.channelId, opts.messageId);
      }
      if (!record) return null;
      return this.createArchiveFromRecords(guild, opts.channelId, [record], {
        kind: 'deleted_message',
        userId: record.authorId,
        createdBy: opts.createdBy ?? null,
        title: 'Deleted message',
        reason: opts.reason ?? null,
        caseId: null,
      });
    } catch (err) {
      this.app.logger.warn('Archive deleted message failed:', err);
      return null;
    }
  }

  public async archiveMessageEdit(opts: {
    guild?: Guild | null;
    guildId: string;
    channelId: string;
    messageId: string;
    before?: Message | null;
    after?: Message | null;
    createdBy?: string | null;
    reason?: string | null;
  }): Promise<ArchiveResult | null> {
    if (!this.enabled || !this.app.config.archives.archive_on_edit) return null;
    const guild = opts.guild ?? this.app.client.guilds.cache.get(opts.guildId);
    if (!guild) return null;
    try {
      const before: SerializedMessage | null = opts.before?.author
        ? await serializeMessageRecord(opts.before)
        : await this.recordFromSnapshot(opts.guildId, opts.channelId, opts.messageId);
      if (!before) return null;
      const after: SerializedMessage | null = opts.after?.author
        ? await serializeMessageRecord(opts.after)
        : await this.recordFromSnapshot(opts.guildId, opts.channelId, opts.messageId);
      if (!after) return null;
      return this.createArchiveFromRecords(guild, opts.channelId, [before, after], {
        kind: 'edited_message',
        userId: after.authorId,
        createdBy: opts.createdBy ?? null,
        title: 'Message edited — before & after',
        reason: opts.reason ?? null,
        caseId: null,
      });
    } catch (err) {
      this.app.logger.warn('Archive edited message failed:', err);
      return null;
    }
  }

  private async recordFromSnapshot(
    guildId: string,
    channelId: string,
    messageId: string,
  ): Promise<SerializedMessage | null> {
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
      embeds: parseJsonArray<StoredEmbed>(row.embeds),
      components: parseJsonArray<unknown>(row.components),
      stickers: parseJsonArray(row.stickers),
      referencedMessage: row.referenced_message ? parseJson(row.referenced_message, null) : null,
      attachments: parseJsonArray(row.attachments),
      createdAt: new Date(row.created_at).getTime(),
    };
  }

  private async findUserRecentChannel(
    guild: Guild,
    userId: string,
    fallbackChannelId: string | null,
  ): Promise<TextBasedChannel | null> {
    const candidates = [...guild.channels.cache.values()]
      .filter((c) => c.isTextBased() && !c.isDMBased() && 'messages' in c)
      .slice(0, 15);
    let best: { channel: TextBasedChannel; createdAt: number } | null = null;
    for (const channel of candidates) {
      try {
        const fetched = await (channel as TextBasedChannel).messages.fetch({ limit: 40 });
        const found = fetched.find((m) => m.author.id === userId);
        if (found && (!best || found.createdTimestamp > best.createdAt)) {
          best = { channel: channel as TextBasedChannel, createdAt: found.createdTimestamp };
        }
      } catch {
        // skip channels we cannot read
      }
    }
    if (best) return best.channel;
    if (fallbackChannelId) {
      const fallback = guild.channels.cache.get(fallbackChannelId);
      if (fallback && fallback.isTextBased() && 'messages' in fallback) return fallback as TextBasedChannel;
    }
    return null;
  }

  private async collectMessages(
    channel: TextBasedChannel,
    amount: number,
    userId: string | null,
    aroundId: string | null,
  ): Promise<Message[]> {
    const cap = Math.min(amount, this.app.config.archives.max_amount);
    const collected: Message[] = [];
    let before: string | undefined;
    for (let i = 0; i < 100 && collected.length < cap; i++) {
      const opts: Record<string, unknown> = { limit: 100 };
      if (aroundId) opts.around = aroundId;
      else if (before) opts.before = before;
      const fetched = await (channel as any).messages.fetch(opts);
      if (fetched.size === 0) break;
      const candidates = aroundId ? [...fetched.values()] : [...fetched.values()];
      for (const m of candidates) {
        if (userId && m.author.id !== userId) continue;
        collected.push(m);
        if (collected.length >= cap) break;
      }
      if (aroundId) break;
      before = fetched.last()?.id;
      if (fetched.size < 100) break;
    }
    return collected;
  }

  private async collectAround(channel: TextBasedChannel, messageId: string, amount: number): Promise<Message[]> {
    const cap = Math.min(amount, this.app.config.archives.max_amount);
    const before = Math.ceil(cap / 2);
    const after = Math.floor(cap / 2);
    const collected = new Map<string, Message>();
    try {
      const around = await (channel as any).messages.fetch({ limit: Math.min(cap, 100), around: messageId });
      for (const m of around.values()) collected.set(m.id, m);
    } catch {
      // center message may already be gone
    }
    if (before > 0) {
      try {
        const prior = await (channel as any).messages.fetch({ limit: Math.min(before, 100), before: messageId });
        for (const m of prior.values()) collected.set(m.id, m);
      } catch {
        // ignore
      }
    }
    if (after > 0) {
      try {
        const later = await (channel as any).messages.fetch({ limit: Math.min(after, 100), after: messageId });
        for (const m of later.values()) collected.set(m.id, m);
      } catch {
        // ignore
      }
    }
    return [...collected.values()].sort((a, b) => a.createdTimestamp - b.createdTimestamp);
  }

  /** Build a single archive from pre-serialized records (used for batched
   *  deleted/edited message archives). Records may span multiple channels and
   *  carry an optional per-message status (deleted/edited_before/edited_after). */
  public async archiveBatch(opts: {
    guildId: string;
    channelId?: string | null;
    records: ArchiveRecordList;
    kind: ArchiveKind;
    title?: string | null;
    reason?: string | null;
    createdBy?: string | null;
  }): Promise<ArchiveResult | null> {
    if (!this.enabled) return null;
    const guild = this.app.client.guilds.cache.get(opts.guildId);
    if (!guild) return null;
    const records: ArchiveRecordInput[] = opts.records
      .map((r) => ('record' in r && r.record ? (r as ArchiveRecordInput) : { record: r as SerializedMessage, status: null }))
      .filter((r) => Boolean(r.record && r.record.authorId));
    if (records.length === 0) return null;
    try {
      return await this.createArchiveFromRecords(guild, opts.channelId ?? null, records, {
        kind: opts.kind,
        userId: null,
        createdBy: opts.createdBy ?? null,
        title: opts.title ?? null,
        reason: opts.reason ?? null,
        caseId: null,
      });
    } catch (err) {
      this.app.logger.warn('Batch archive failed:', err);
      return null;
    }
  }

  private async createArchiveFromRecords(
    guild: Guild,
    channelId: string | null,
    records: ArchiveRecordList,
    opts: {
      kind: ArchiveKind;
      userId: string | null;
      createdBy: string | null;
      title: string | null;
      reason: string | null;
      caseId: number | null;
    },
  ): Promise<ArchiveResult> {
    const normalized: Array<{ record: SerializedMessage; status: string | null }> = records.map((r) => ({
      record: 'record' in r ? r.record : r,
      status: 'record' in r ? (r.status ?? null) : null,
    }));
    const code = generateArchiveCode();
    const [result] = await this.app.db.execute(
      `INSERT INTO archives (code, guild_id, channel_id, filter_user_id, kind, title, reason, created_by, case_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [code, guild.id, channelId, opts.userId, opts.kind, opts.title, opts.reason, opts.createdBy, opts.caseId],
    );
    const archiveId = (result as { insertId: number }).insertId;

    let mediaCount = 0;
    let totalBytes = 0;
    const avatarMedia = new Map<string, number>();

    for (let i = 0; i < normalized.length; i++) {
      const { record: rec, status } = normalized[i];
      const embeds = await this.storeEmbedMedia(archiveId, rec.embeds, totalBytes);
      const [mRes] = await this.app.db.execute(
        `INSERT INTO archive_messages
          (archive_id, message_id, channel_id, author_id, author_username, author_nickname, author_avatar, author_is_bot, content, embeds, components, stickers, referenced_message, created_at, position, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          archiveId,
          rec.messageId,
          channelId,
          rec.authorId,
          rec.authorUsername,
          rec.authorNickname,
          rec.authorAvatar,
          rec.authorIsBot ? 1 : 0,
          rec.content || null,
          JSON.stringify(embeds),
          JSON.stringify(rec.components),
          JSON.stringify(rec.stickers),
          JSON.stringify(rec.referencedMessage),
          new Date(rec.createdAt),
          i,
          status,
        ],
      );
      const messageRowId = (mRes as { insertId: number }).insertId;

      for (const att of rec.attachments) {
        const dl = await this.downloadMedia(att.url);
        if (!dl) continue;
        const size = dl.buffer.length;
        if (totalBytes + size > this.app.config.archives.max_archive_bytes) continue;
        const kind = classifyMedia(dl.contentType, att.name);
        await this.app.db.execute(
          `INSERT INTO archive_media (archive_id, archive_message_id, kind, name, content_type, size, width, height, original_url, data)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [archiveId, messageRowId, kind, att.name?.slice(0, 255) ?? null, dl.contentType, size, att.width ?? null, att.height ?? null, att.url, dl.buffer],
        );
        mediaCount++;
        totalBytes += size;
      }

      if (!avatarMedia.has(rec.authorId)) {
        const dl = await this.downloadMedia(rec.authorAvatar, 5 * 1024 * 1024);
        if (dl) {
          const size = dl.buffer.length;
          if (totalBytes + size <= this.app.config.archives.max_archive_bytes) {
            await this.app.db.execute(
              `INSERT INTO archive_media (archive_id, author_id, kind, name, content_type, size, original_url, data)
               VALUES (?, ?, 'avatar', ?, ?, ?, ?, ?)`,
              [archiveId, rec.authorId, `${rec.authorUsername}.png`, dl.contentType, size, rec.authorAvatar, dl.buffer],
            );
            mediaCount++;
            totalBytes += size;
          }
        }
        avatarMedia.set(rec.authorId, 1);
      }
    }

    await this.app.db.execute(
      'UPDATE archives SET message_count = ?, media_count = ?, total_bytes = ? WHERE id = ?',
      [normalized.length, mediaCount, totalBytes, archiveId],
    );

    const link = this.getPublicLink(code);
    await this.app.logManager.log({
      event: 'archive_created',
      guildId: guild.id,
      channelId,
      actorId: opts.createdBy ?? null,
      targetId: opts.userId ?? null,
      message: `Archived ${records.length} message(s) — ${link}`,
      details: {
        code,
        link,
        kind: opts.kind,
        messageCount: records.length,
        mediaCount,
        totalBytes,
        channelId,
        userId: opts.userId,
        caseId: opts.caseId,
        title: opts.title,
      },
    });

    return { id: archiveId, code, link, messageCount: records.length };
  }

  private async storeEmbedMedia(archiveId: number, embeds: StoredEmbed[], totalBytes: number): Promise<StoredEmbed[]> {
    const out: StoredEmbed[] = [];
    for (const embed of embeds) {
      const item = { ...embed };
      if (embed.thumbnail?.url && !embed.thumbnail.media_id) {
        const dl = await this.downloadMedia(embed.thumbnail.url);
        if (dl && totalBytes + dl.buffer.length <= this.app.config.archives.max_archive_bytes) {
          const [res] = await this.app.db.execute(
            `INSERT INTO archive_media (archive_id, kind, name, content_type, size, width, height, original_url, data)
             VALUES (?, 'image', ?, ?, ?, ?, ?, ?, ?)`,
            [archiveId, 'embed-image.png', dl.contentType, dl.buffer.length, embed.thumbnail.width ?? null, embed.thumbnail.height ?? null, embed.thumbnail.url, dl.buffer],
          );
          item.thumbnail = { ...embed.thumbnail, media_id: (res as { insertId: number }).insertId };
        }
      }
      if (embed.image?.url && !embed.image.media_id) {
        const dl = await this.downloadMedia(embed.image.url);
        if (dl && totalBytes + dl.buffer.length <= this.app.config.archives.max_archive_bytes) {
          const [res] = await this.app.db.execute(
            `INSERT INTO archive_media (archive_id, kind, name, content_type, size, width, height, original_url, data)
             VALUES (?, 'image', ?, ?, ?, ?, ?, ?, ?)`,
            [archiveId, 'embed-image.png', dl.contentType, dl.buffer.length, embed.image.width ?? null, embed.image.height ?? null, embed.image.url, dl.buffer],
          );
          item.image = { ...embed.image, media_id: (res as { insertId: number }).insertId };
        }
      }
      out.push(item);
    }
    return out;
  }

  private async downloadMedia(url: string, sizeCap?: number): Promise<DownloadedMedia | null> {
    const cap = sizeCap ?? this.app.config.archives.max_attachment_bytes;
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), MEDIA_DOWNLOAD_TIMEOUT_MS);
      try {
        const res = await fetch(url, { signal: controller.signal });
        if (!res.ok) return null;
        const length = Number(res.headers.get('content-length') ?? 0);
        if (length > cap) return null;
        const buf = Buffer.from(await res.arrayBuffer());
        if (buf.length === 0 || buf.length > cap) return null;
        return { buffer: buf, contentType: res.headers.get('content-type') };
      } finally {
        clearTimeout(timer);
      }
    } catch {
      return null;
    }
  }

  public async getByCode(code: string): Promise<ArchiveRow | null> {
    const [rows] = await this.app.db.query<ArchiveRow[]>('SELECT * FROM archives WHERE code = ?', [code]);
    return rows[0] ?? null;
  }
}

function parseJson<T>(raw: unknown, fallback: T): T {
  if (raw == null) return fallback;
  try {
    return JSON.parse(String(raw)) as T;
  } catch {
    return fallback;
  }
}

function parseJsonArray<T>(raw: unknown): T[] {
  const v = parseJson<unknown>(raw, []);
  return Array.isArray(v) ? (v as T[]) : [];
}

function classifyMedia(contentType: string | null, name?: string | null): string {
  const lowerName = (name ?? '').toLowerCase();
  if (contentType) {
    if (contentType === 'image/gif') return 'gif';
    if (contentType.startsWith('image/')) return 'image';
    if (contentType.startsWith('video/')) return 'video';
    if (contentType.startsWith('audio/')) return 'audio';
    if (contentType === 'application/json') return 'file';
    if (contentType.startsWith('text/')) return 'file';
  }
  if (/\.(png|jpe?g|webp|bmp|avif)$/.test(lowerName)) return 'image';
  if (lowerName.endsWith('.gif')) return 'gif';
  if (/\.(mp4|webm|mov|mkv|m4v)$/.test(lowerName)) return 'video';
  if (/\.(mp3|wav|ogg|flac|m4a|aac)$/.test(lowerName)) return 'audio';
  return 'file';
}
