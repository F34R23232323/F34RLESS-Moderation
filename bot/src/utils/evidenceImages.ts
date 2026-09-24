import { randomBytes } from 'crypto';
import type { ChatInputCommandInteraction, Message } from 'discord.js';
import type { App } from '../core/context';
import type { CaseEvidenceItem } from './evidence';

const MAX_EVIDENCE_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_EVIDENCE_IMAGES_PER_COMMAND = 4;
const DOWNLOAD_TIMEOUT_MS = 15_000;

const EXT_BY_TYPE: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/bmp': 'bmp',
  'image/avif': 'avif',
};

const IMAGE_NAME_RE = /\.(png|jpe?g|gif|webp|bmp|avif)$/i;

/** Resolve the stored content type for an evidence image, or null when the
 *  attachment is not an image (declared type first, then filename). */
export function evidenceImageType(
  declaredType?: string | null,
  downloadedType?: string | null,
  name?: string | null,
): string | null {
  for (const t of [downloadedType, declaredType]) {
    const lower = (t ?? '').toLowerCase().split(';')[0].trim();
    if (lower.startsWith('image/')) return lower;
  }
  const ext = (name ?? '').toLowerCase().match(IMAGE_NAME_RE)?.[1];
  if (!ext) return null;
  if (ext === 'jpeg' || ext === 'jpg') return 'image/jpeg';
  return `image/${ext}`;
}

export function evidenceImageExt(contentType: string, name?: string | null): string {
  const fromType = EXT_BY_TYPE[contentType.toLowerCase().split(';')[0].trim()];
  if (fromType) return fromType;
  const ext = (name ?? '').toLowerCase().match(IMAGE_NAME_RE)?.[1];
  if (ext) return ext === 'jpeg' ? 'jpg' : ext;
  return 'png';
}

export function buildEvidenceUrl(baseUrl: string, code: string, ext: string): string {
  return `${baseUrl.replace(/\/+$/, '')}/api/evidence/${code}.${ext}`;
}

interface EvidenceImageSource {
  url: string;
  name?: string | null;
  contentType?: string | null;
  size?: number | null;
}

async function downloadImage(url: string): Promise<{ buffer: Buffer; contentType: string | null } | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT_MS);
    try {
      const res = await fetch(url, { signal: controller.signal });
      if (!res.ok) return null;
      const length = Number(res.headers.get('content-length') ?? 0);
      if (length > MAX_EVIDENCE_IMAGE_BYTES) return null;
      const buffer = Buffer.from(await res.arrayBuffer());
      if (buffer.length === 0 || buffer.length > MAX_EVIDENCE_IMAGE_BYTES) return null;
      return { buffer, contentType: res.headers.get('content-type') };
    } finally {
      clearTimeout(timer);
    }
  } catch {
    return null;
  }
}

/** Download an image attachment, store it in the database, and return the
 *  evidence item with its custom public URL. Best-effort: storage failures
 *  log a warning and return null so the punishment itself never blocks. */
export async function storeEvidenceImage(
  app: App,
  source: EvidenceImageSource,
  ctx: { guildId: string; channelId?: string | null; uploadedBy?: string | null },
): Promise<CaseEvidenceItem | null> {
  try {
    const declaredType = evidenceImageType(source.contentType, null, source.name);
    if (!declaredType) return null;
    if (source.size != null && source.size > MAX_EVIDENCE_IMAGE_BYTES) {
      app.logger.warn(`Evidence image ${source.name ?? source.url} exceeds the ${MAX_EVIDENCE_IMAGE_BYTES} byte cap; skipped.`);
      return null;
    }

    const downloaded = await downloadImage(source.url);
    if (!downloaded) {
      app.logger.warn(`Evidence image download failed: ${source.url}`);
      return null;
    }

    const contentType = evidenceImageType(source.contentType, downloaded.contentType, source.name) ?? declaredType;
    const ext = evidenceImageExt(contentType, source.name);
    const code = randomBytes(8).toString('hex');

    await app.db.execute(
      `INSERT INTO evidence_images (code, guild_id, channel_id, name, content_type, size, original_url, uploaded_by, data)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        code,
        ctx.guildId,
        ctx.channelId ?? null,
        source.name?.slice(0, 255) ?? null,
        contentType,
        downloaded.buffer.length,
        source.url.slice(0, 500),
        ctx.uploadedBy ?? null,
        downloaded.buffer,
      ],
    );

    const base = app.env.DASHBOARD_BASE_URL || 'http://localhost:4693';
    return { type: 'image', url: buildEvidenceUrl(base, code, ext), name: source.name ?? null };
  } catch (err) {
    app.logger.warn('Storing evidence image failed:', err);
    return null;
  }
}

export async function storeEvidenceImages(
  app: App,
  sources: EvidenceImageSource[],
  ctx: { guildId: string; channelId?: string | null; uploadedBy?: string | null },
): Promise<CaseEvidenceItem[]> {
  const items: CaseEvidenceItem[] = [];
  for (const source of sources.slice(0, MAX_EVIDENCE_IMAGES_PER_COMMAND)) {
    const item = await storeEvidenceImage(app, source, ctx);
    if (item) items.push(item);
  }
  return items;
}

/** Read the optional `evidence` attachment option from a moderation slash
 *  command and store it, returning the evidence items to attach to the case. */
export async function collectSlashEvidence(
  app: App,
  interaction: ChatInputCommandInteraction,
): Promise<CaseEvidenceItem[]> {
  const guildId = interaction.guildId;
  if (!guildId) return [];
  const attachment = interaction.options.getAttachment('evidence');
  if (!attachment) return [];
  return storeEvidenceImages(app, [attachment], {
    guildId,
    channelId: interaction.channelId,
    uploadedBy: interaction.user.id,
  });
}

/** Collect image attachments from the command message itself so prefix
 *  commands (`!ban ...` sent with images) store them as evidence too. */
export async function collectMessageImageEvidence(app: App, message: Message): Promise<CaseEvidenceItem[]> {
  const guildId = message.guildId;
  if (!guildId) return [];
  const attachments = [...message.attachments.values()];
  if (attachments.length === 0) return [];
  return storeEvidenceImages(app, attachments, {
    guildId,
    channelId: message.channelId,
    uploadedBy: message.author.id,
  });
}
