import type { Pool } from 'mysql2/promise';

interface SharpInstance {
  resize(w: number, h: number, opts?: { fit?: string }): SharpInstance;
  greyscale(): SharpInstance;
  raw(): SharpInstance;
  toBuffer(): Promise<Buffer>;
}
type SharpModule = (input: Buffer) => SharpInstance;

let sharpModule: SharpModule | null = null;
function getSharp(): SharpModule | null {
  if (!sharpModule) {
    try {
      sharpModule = require('sharp') as SharpModule;
    } catch (err) {
      console.error('[ScamHash] Failed to load sharp:', (err as Error).message);
      return null;
    }
  }
  return sharpModule;
}

export interface ScamHashEntry {
  id: number;
  hash: string;
  description: string;
}

function hammingDistance(a: string, b: string): number {
  if (a.length !== b.length) return Infinity;
  let dist = 0;
  for (let i = 0; i < a.length; i += 2) {
    const xor = parseInt(a.slice(i, i + 2), 16) ^ parseInt(b.slice(i, i + 2), 16);
    dist += xor.toString(2).split('0').join('').length;
  }
  return dist;
}

export async function computeAHash(url: string, timeoutMs = 15_000): Promise<string | null> {
  try {
    const sharp = getSharp();
    if (!sharp) return null;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) {
      console.error(`[ScamHash] Failed to fetch image: HTTP ${res.status} from ${url.slice(0, 80)}`);
      return null;
    }
    const buf = Buffer.from(await res.arrayBuffer());
    const pixels = await sharp(buf).resize(8, 8, { fit: 'fill' }).greyscale().raw().toBuffer();
    let sum = 0;
    for (let i = 0; i < 64; i++) sum += pixels[i];
    const avg = sum / 64;
    let hash = '';
    for (let i = 0; i < 64; i++) {
      hash += pixels[i] >= avg ? '1' : '0';
    }
    const hex = BigInt('0b' + hash).toString(16).padStart(16, '0');
    return hex;
  } catch (err) {
    console.error(`[ScamHash] Failed to compute hash for ${url.slice(0, 80)}:`, (err as Error).message);
    return null;
  }
}

export class ScamHashStore {
  private hashes: ScamHashEntry[] = [];
  private readonly db: Pool;

  constructor(db: Pool) {
    this.db = db;
  }

  public async load(): Promise<void> {
    const [rows] = await this.db.query('SELECT id, hash, description FROM scam_image_hashes');
    this.hashes = (rows as Array<{ id: number; hash: string; description: string }>).map((r) => ({
      id: r.id,
      hash: r.hash.toLowerCase(),
      description: r.description,
    }));
  }

  public async add(hash: string, description: string, addedBy: string): Promise<boolean> {
    const normalized = hash.toLowerCase();
    try {
      await this.db.execute('INSERT INTO scam_image_hashes (hash, description, added_by) VALUES (?, ?, ?)', [
        normalized,
        description,
        addedBy,
      ]);
      const [rows] = await this.db.query('SELECT id, hash, description FROM scam_image_hashes WHERE hash = ?', [normalized]);
      const entry = (rows as ScamHashEntry[])[0];
      if (entry) this.hashes.push(entry);
      return true;
    } catch (err) {
      console.error('[ScamHash] Failed to add hash:', (err as Error).message);
      return false;
    }
  }

  public async remove(hash: string): Promise<boolean> {
    const normalized = hash.toLowerCase();
    const [result] = await this.db.execute('DELETE FROM scam_image_hashes WHERE hash = ?', [normalized]);
    const info = result as { affectedRows: number };
    if (info.affectedRows > 0) {
      this.hashes = this.hashes.filter((h) => h.hash !== normalized);
      return true;
    }
    return false;
  }

  public check(hex: string, threshold = 0): ScamHashEntry | null {
    const normalized = hex.toLowerCase();
    for (const entry of this.hashes) {
      if (hammingDistance(normalized, entry.hash) <= threshold) return entry;
    }
    return null;
  }

  public count(): number {
    return this.hashes.length;
  }

  public getAll(): ScamHashEntry[] {
    return [...this.hashes];
  }
}
