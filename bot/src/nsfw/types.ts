/**
 * Minimal structural types for the heavy native modules (tfjs-node, sharp,
 * nsfwjs). The real packages are only required lazily at runtime, so the bot
 * typechecks and runs without them installed (e.g. during development) and a
 * missing/broken install only disables NSFW moderation instead of crashing.
 */

export interface NsfwTensor {
  dispose(): void;
  toFloat(): NsfwTensor;
  div(value: number): NsfwTensor;
  expandDims(axis: number): NsfwTensor;
}

export interface TfModule {
  tensor3d(values: ArrayLike<number>, shape: [number, number, number]): NsfwTensor;
}

export interface NsfwPrediction {
  className: string;
  probability: number;
}

export interface NsfwClassifier {
  classify(tensor: NsfwTensor, topk?: number): Promise<NsfwPrediction[]>;
}

export interface NsfwjsModule {
  load(path?: string, size?: number): Promise<NsfwClassifier>;
}

export interface SharpMetadata {
  width?: number;
  height?: number;
  size?: number;
  pages?: number;
}

export interface SharpRawOutput {
  data: Buffer;
  info: { width: number; height: number };
}

export interface SharpInstance {
  rotate(): SharpInstance;
  resize(width: number, height: number, opts?: { fit?: 'fill' | 'cover' | 'contain' | 'inside' | 'outside' }): SharpInstance;
  flatten(opts?: { background?: { r: number; g: number; b: number } }): SharpInstance;
  toColourspace(space: 'srgb'): SharpInstance;
  raw(): SharpInstance;
  metadata(): Promise<SharpMetadata>;
  toBuffer(opts: { resolveWithObject: true }): Promise<SharpRawOutput>;
  toBuffer(opts?: { resolveWithObject?: false }): Promise<Buffer>;
}

export interface SharpModule {
  (input: Buffer, opts?: { limitInputPixels?: number }): SharpInstance;
}

export function lazyRequire<T>(id: string): T {
  return require(id) as T;
}