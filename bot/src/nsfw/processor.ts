import type { NsfwClassifier, NsfwPrediction, SharpModule, TfModule } from './types';
import { lazyRequire } from './types';

const IMAGE_EXTENSION_RE = /\.(png|jpe?g|gif|webp)$/i;
const IMAGE_MIME_RE = /^image\/(png|jpe?g|gif|webp)$/;

/** Only these hosts are ever downloaded from. Attachment URLs come from the
 *  message's attachments — message content is never used as a source. */
const TRUSTED_HOSTS = new Set(['cdn.discordapp.com', 'media.discordapp.net', 'discordapp.net', 'discord.com']);

/** NSFWJS MobileNetV2 input size. */
const TARGET_SIZE = 224;
/** Pixels per side — beyond this the image is rejected before decoding. */
const MAX_IMAGE_DIMENSION = 8192;
/** sharp limitInputPixels: rejects decompression-bomb style images. */
const MAX_IMAGE_PIXELS = 50_000_000;

export interface ScanOptions {
  maxBytes: number;
  timeoutMs: number;
}

export interface ScanResult {
  url: string;
  predictions: NsfwPrediction[];
  /** Porn + Hentai as returned by NSFWJS. */
  explicitScore: number;
}

export interface ImageProcessorDeps {
  tf?: TfModule;
  sharp?: SharpModule;
  fetchImpl?: typeof fetch;
  getModel: () => Promise<NsfwClassifier>;
}

export function isImageAttachment(name: string | null, contentType: string | null): boolean {
  return Boolean((name && IMAGE_EXTENSION_RE.test(name)) || (contentType && IMAGE_MIME_RE.test(contentType)));
}

export class NsfwImageProcessor {
  private readonly tf: TfModule;
  private readonly sharp: SharpModule;
  private readonly fetchImpl: typeof fetch;
  private readonly getModel: () => Promise<NsfwClassifier>;

  constructor(deps: ImageProcessorDeps) {
    this.tf = deps.tf ?? lazyRequire<TfModule>('@tensorflow/tfjs-node');
    this.sharp = deps.sharp ?? lazyRequire<SharpModule>('sharp');
    this.fetchImpl = deps.fetchImpl ?? (globalThis.fetch.bind(globalThis) as typeof fetch);
    this.getModel = deps.getModel;
  }

  /** Download + normalize + classify one attachment. Every failure throws so
   *  callers can log-and-continue without punishing anyone. */
  public async scan(url: string, opts: ScanOptions): Promise<ScanResult> {
    let host: string;
    try {
      host = new URL(url).hostname;
    } catch {
      throw new Error(`invalid attachment URL: ${url.slice(0, 80)}`);
    }
    if (!TRUSTED_HOSTS.has(host)) {
      throw new Error(`untrusted attachment host: ${host}`);
    }

    const buffer = await this.download(url, opts);
    try {
      const meta = await this.sharp(buffer, { limitInputPixels: MAX_IMAGE_PIXELS }).metadata();
      const width = meta.width ?? 0;
      const height = meta.height ?? 0;
      if (width <= 0 || height <= 0) throw new Error('unreadable image dimensions');
      if (width > MAX_IMAGE_DIMENSION || height > MAX_IMAGE_DIMENSION) {
        throw new Error(`image dimensions too extreme: ${width}x${height}`);
      }

      const raw = await this.sharp(buffer, { limitInputPixels: MAX_IMAGE_PIXELS })
        .rotate() // honour EXIF orientation
        .resize(TARGET_SIZE, TARGET_SIZE, { fit: 'fill' })
        .flatten({ background: { r: 0, g: 0, b: 0 } }) // composite alpha on black
        .toColourspace('srgb')
        .raw()
        .toBuffer({ resolveWithObject: true });

      return await this.classify(raw.data, url);
    } finally {
      // the attachment buffer is not retained beyond this point
    }
  }

  private async classify(rawRgb: Buffer, url: string): Promise<ScanResult> {
    const tensor = this.tf
      .tensor3d(new Uint8Array(rawRgb.buffer, rawRgb.byteOffset, rawRgb.byteLength), [TARGET_SIZE, TARGET_SIZE, 3])
      .toFloat()
      .div(255)
      .expandDims(0);
    try {
      const model = await this.getModel();
      const predictions = await model.classify(tensor);
      const explicitScore = predictions
        .filter((p) => p.className === 'Porn' || p.className === 'Hentai')
        .reduce((sum, p) => sum + p.probability, 0);
      return { url, predictions, explicitScore };
    } finally {
      tensor.dispose();
    }
  }

  private async download(url: string, opts: ScanOptions): Promise<Buffer> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), opts.timeoutMs);
    try {
      const res = await this.fetchImpl(url, { signal: controller.signal, redirect: 'follow' });
      if (!res.ok) throw new Error(`download failed: HTTP ${res.status}`);
      const declared = Number(res.headers.get('content-length') ?? 0);
      if (declared > opts.maxBytes) throw new Error('attachment exceeds size limit');
      const data = Buffer.from(await res.arrayBuffer());
      if (data.length === 0) throw new Error('attachment is empty');
      if (data.length > opts.maxBytes) throw new Error('attachment exceeds size limit');
      return data;
    } catch (err) {
      const e = err as { name?: string };
      if (e?.name === 'AbortError' || e?.name === 'TimeoutError') {
        throw new Error(`download timed out after ${opts.timeoutMs}ms`);
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }
}