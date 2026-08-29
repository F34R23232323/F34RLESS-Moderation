import { test } from 'node:test';
import assert from 'node:assert/strict';

import { NsfwImageProcessor, isImageAttachment } from '../src/nsfw/processor';
import { BoundedQueue } from '../src/nsfw/queue';
import { NsfwModerationService } from '../src/nsfw/service';
import type { NsfwModerationConfig } from '../../shared/src/index';

// ---------------------------------------------------------------------------
// Fakes (no real model / network / native modules involved)
// ---------------------------------------------------------------------------

class FakeTensor {
  public disposed = false;
  constructor(public readonly values: ArrayLike<number>) {}
  toFloat(): this {
    return this;
  }
  div(_value: number): this {
    return this;
  }
  expandDims(_axis: number): this {
    return this;
  }
  dispose(): void {
    this.disposed = true;
  }
}

interface FakeTfHandle {
  tensors: FakeTensor[];
  module: { tensor3d(values: ArrayLike<number>): FakeTensor };
}

function fakeTf(): FakeTfHandle {
  const tensors: FakeTensor[] = [];
  return {
    tensors,
module: {
      tensor3d(values) {
        const t = new FakeTensor(values);
        tensors.push(t);
        return t;
      },
    },
  };
}

function fakeSharp(meta: { width?: number; height?: number } = { width: 640, height: 480 }) {
  return (_input: Buffer, _opts?: unknown) => {
    const pipeline = {
      rotate: () => pipeline,
      resize: () => pipeline,
      flatten: () => pipeline,
      toColourspace: () => pipeline,
      raw: () => pipeline,
      metadata: async () => meta,
      toBuffer: async () => ({ data: Buffer.alloc(224 * 224 * 3), info: { width: 224, height: 224 } }),
    };
    return pipeline;
  };
}

type FetchBehavior =
  | { kind: 'ok'; body?: Buffer; contentLength?: number }
  | { kind: 'status'; status: number }
  | { kind: 'hang'; abortable?: boolean };

function fakeFetch(behavior: FetchBehavior) {
  return async (_input: unknown, init?: { signal?: AbortSignal }) => {
    if (behavior.kind === 'hang') {
      return new Promise((_resolve, reject) => {
        if (behavior.abortable) {
          init?.signal?.addEventListener('abort', () =>
            reject(Object.assign(new Error('aborted'), { name: 'AbortError' })),
          );
        }
      });
    }
    if (behavior.kind === 'status') {
      return { ok: false, status: behavior.status, headers: { get: () => null }, arrayBuffer: async () => new ArrayBuffer(0) };
    }
    const body = behavior.body ?? Buffer.from([0x89, 0x50, 0x4e, 0x47]);
    return {
      ok: true,
      status: 200,
      headers: { get: (k: string) => (k.toLowerCase() === 'content-length' ? String(behavior.contentLength ?? body.length) : null) },
      arrayBuffer: async () => body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength),
    };
  };
}

type NsfwPrediction = { className: string; probability: number };

function predictions(explicit: number): NsfwPrediction[] {
  const porn = Math.min(explicit, 1);
  return [
    { className: 'Porn', probability: porn },
    { className: 'Hentai', probability: Math.max(0, explicit - porn) },
    { className: 'Neutral', probability: Math.max(0, 1 - explicit) },
    { className: 'Drawing', probability: 0 },
    { className: 'Sexy', probability: 0 },
  ];
}

function makeClassifier(model: { classify: (t: FakeTensor) => Promise<NsfwPrediction[]> }) {
  return { classify: (tensor: unknown) => model.classify(tensor as FakeTensor) };
}

function nsfwConfig(overrides: Partial<NsfwModerationConfig> = {}): NsfwModerationConfig {
  return {
    enabled: true,
    guilds: [],
    ignored_channels: [],
    exempt_roles: [],
    max_attachment_bytes: 10 * 1024 * 1024,
    download_timeout_ms: 15_000,
    queue_capacity: 25,
    worker_concurrency: 1,
    review_threshold: 0.6,
    delete_threshold: 0.8,
    log_only: false,
    ignored_categories: [],
    ...overrides,
  };
}

function makeApp(overrides: { config?: Partial<NsfwModerationConfig>; automod?: Record<string, unknown>; reportError?: (err: Error) => void } = {}) {
  const reports: Array<Record<string, unknown>> = [];
  const warns: string[] = [];
  const errors: string[] = [];
  const app = {
    config: {
      nsfw_moderation: nsfwConfig(overrides.config),
      automod: overrides.automod ?? {},
    },
    logger: {
      info: () => undefined,
      warn: (...args: unknown[]) => warns.push(String(args[0])),
      error: (...args: unknown[]) => errors.push(String(args[0])),
    },
    logManager: { reportError: async (_src: string, err: unknown) => overrides.reportError?.(err as Error) },
    client: { user: { id: 'bot-id' } },
    reporting: {
      createReport: async (input: Record<string, unknown>) => {
        reports.push(input);
        return { id: reports.length, merged: false };
      },
    },
  };
  return { app, reports, warns, errors };
}

interface FakeAttachment {
  id: string;
  name: string | null;
  url: string;
  contentType: string | null;
}

function attachment(id: string, name = `${id}.png`, url = `https://cdn.discordapp.com/attachments/chan-1/${id}/${name}`, contentType = 'image/png'): FakeAttachment {
  return { id, name, url, contentType };
}

function makeMessage(opts: {
  id?: string;
  guildId?: string | null;
  channelId?: string;
  authorId?: string;
  bot?: boolean;
  webhookId?: string | null;
  inGuild?: boolean;
  attachments?: FakeAttachment[];
  content?: string;
  memberRoles?: string[];
  deletable?: boolean;
} = {}) {
  const deleteCalls: string[] = [];
  const attachments = new Map((opts.attachments ?? []).map((a) => [a.id, a]));
  const msg = {
    id: opts.id ?? 'msg-1',
    guildId: opts.guildId ?? 'guild-1',
    channelId: opts.channelId ?? 'chan-1',
    author: { id: opts.authorId ?? 'user-1', bot: opts.bot ?? false },
    webhookId: opts.webhookId ?? null,
    attachments,
    content: opts.content ?? 'hello',
    url: `https://discord.com/channels/${opts.guildId ?? 'guild-1'}/${opts.channelId ?? 'chan-1'}/${opts.id ?? 'msg-1'}`,
    inGuild: () => opts.inGuild ?? true,
    member: opts.memberRoles ? { roles: { cache: new Map(opts.memberRoles.map((r) => [r, { id: r }])) } } : null,
    deletable: opts.deletable ?? true,
    delete: async () => {
      deleteCalls.push(opts.id ?? 'msg-1');
    },
  };
  return { msg, deleteCalls };
}

function makeProcessor(opts: {
  fetchBehavior?: FetchBehavior;
  sharpMeta?: { width?: number; height?: number };
}): {
  processor: NsfwImageProcessor;
  tf: FakeTfHandle;
  model: { classify: (t: FakeTensor) => Promise<NsfwPrediction[]>; lastTensor?: FakeTensor };
  setPredictions: (preds: NsfwPrediction[]) => void;
} {
  const tf = fakeTf();
  const state = { preds: predictions(0.1) };
  const model = {
    lastTensor: undefined as FakeTensor | undefined,
    classify: async (t: FakeTensor) => {
      model.lastTensor = t;
      return state.preds;
    },
  };
  const processor = new NsfwImageProcessor({
    tf: tf.module,
    sharp: fakeSharp(opts.sharpMeta),
    fetchImpl: fakeFetch(opts.fetchBehavior ?? { kind: 'ok' }) as never,
    getModel: async () => makeClassifier(model) as never,
  });
  return {
    processor,
    tf,
    model,
    setPredictions: (preds) => {
      state.preds = preds;
    },
  };
}

async function makeReadyService(
  app: ReturnType<typeof makeApp>['app'],
  processor: NsfwImageProcessor,
  model: { classify: (t: FakeTensor) => Promise<NsfwPrediction[]> },
) {
  const service = new NsfwModerationService(app as never, { processor });
  await service.init(async () => makeClassifier(model) as never);
  return service;
}

function settle() {
  return new Promise((resolve) => setTimeout(resolve, 15));
}

// ---------------------------------------------------------------------------
// Unit: attachment type detection
// ---------------------------------------------------------------------------

test('isImageAttachment accepts supported image types only', () => {
  assert.equal(isImageAttachment('photo.png', 'image/png'), true);
  assert.equal(isImageAttachment('photo.jpg', null), true);
  assert.equal(isImageAttachment('photo.GIF', null), true);
  assert.equal(isImageAttachment('photo.webp', null), true);
  assert.equal(isImageAttachment('photo', 'image/jpeg'), true);
  assert.equal(isImageAttachment('clip.mp4', 'video/mp4'), false);
  assert.equal(isImageAttachment('notes.txt', 'text/plain'), false);
  assert.equal(isImageAttachment(null, null), false);
});

// ---------------------------------------------------------------------------
// Unit: bounded queue
// ---------------------------------------------------------------------------

test('BoundedQueue runs FIFO with bounded capacity and dedupes ids', async () => {
  const order: string[] = [];
  const queue = new BoundedQueue(2, 1);
  const job = (id: string) => ({ id, run: async () => void order.push(id) });

  assert.equal(queue.enqueue(job('a')), true, 'first job starts immediately');
  assert.equal(queue.enqueue(job('b')), true, 'second job queued');
  assert.equal(queue.enqueue(job('b')), false, 'duplicate id rejected while queued');
  assert.equal(queue.enqueue(job('c')), true, 'still room at capacity 2');
  assert.equal(queue.enqueue(job('d')), false, 'queue at capacity rejected');
  await settle();
  assert.deepEqual(order, ['a', 'b', 'c'], 'FIFO order with one worker');
  assert.equal(queue.enqueue(job('a')), true, 'completed id can run again');
  queue.stop();
  assert.equal(queue.enqueue(job('e')), false, 'stopped queue rejects');
});

// ---------------------------------------------------------------------------
// Service: outcomes
// ---------------------------------------------------------------------------

test('safe image (below review threshold) takes no action and releases tensors', async () => {
  const harness = makeProcessor({});
  harness.setPredictions(predictions(0.05));
  const { app, reports } = makeApp();
  const service = await makeReadyService(app, harness.processor, harness.model);

  const { msg, deleteCalls } = makeMessage({ attachments: [attachment('a1')] });
  await service.handleMessage(msg);
  await settle();

  assert.equal(reports.length, 0);
  assert.equal(deleteCalls.length, 0);
  assert.equal(harness.tf.tensors.length, 1);
  assert.equal(harness.tf.tensors[0].disposed, true, 'tensor disposed in finally');
});

test('review-level image reports without deleting', async () => {
  const harness = makeProcessor({});
  harness.setPredictions(predictions(0.7));
  const { app, reports } = makeApp();
  const service = await makeReadyService(app, harness.processor, harness.model);

  const { msg, deleteCalls } = makeMessage({ attachments: [attachment('a1', 'hot.png')] });
  await service.handleMessage(msg);
  await settle();

  assert.equal(deleteCalls.length, 0);
  assert.equal(reports.length, 1);
  const report = reports[0];
  assert.equal(report.sourceModule, 'nsfw');
  assert.equal(report.targetUserId, 'user-1');
  assert.equal(report.targetMessageId, 'msg-1');
  assert.equal(report.sourceChannelId, 'chan-1');
  assert.equal(report.reporterId, 'bot-id');
  const reason = String(report.reason);
  assert.match(reason, /Automated image moderation/);
  assert.match(reason, /<@user-1>/);
  assert.match(reason, /<#chan-1>/);
  assert.match(reason, /msg-1/);
  assert.match(reason, /hot\.png/);
  assert.match(reason, /Porn: 70\.00%/);
  assert.match(reason, /Explicit \(Porn \+ Hentai\): \*\*70\.00%\*\*/);
  assert.match(reason, /Threshold: 60\.00%/);
  assert.match(reason, /Action: \*\*Review\*\*/);
  assert.equal(report.attachmentUrls[0], 'https://cdn.discordapp.com/attachments/chan-1/a1/hot.png');
});

test('delete-level image deletes once and reports Deleted', async () => {
  const harness = makeProcessor({});
  harness.setPredictions(predictions(0.92));
  const { app, reports } = makeApp();
  const service = await makeReadyService(app, harness.processor, harness.model);

  const { msg, deleteCalls } = makeMessage({ attachments: [attachment('a1')] });
  await service.handleMessage(msg);
  await settle();

  assert.equal(deleteCalls.length, 1);
  assert.equal(reports.length, 1);
  assert.match(String(reports[0].reason), /Action: \*\*Deleted\*\*/);
  assert.match(String(reports[0].reason), /Threshold: 80\.00%/);
});

test('log-only mode never deletes and marks reports TEST MODE', async () => {
  const harness = makeProcessor({});
  harness.setPredictions(predictions(0.98));
  const { app, reports } = makeApp({ config: { log_only: true } });
  const service = await makeReadyService(app, harness.processor, harness.model);

  const { msg, deleteCalls } = makeMessage({ attachments: [attachment('a1')] });
  await service.handleMessage(msg);
  await settle();

  assert.equal(deleteCalls.length, 0, 'log-only never deletes');
  assert.equal(reports.length, 1);
  assert.match(String(reports[0].reason), /TEST MODE — LOG ONLY/);
  assert.match(String(reports[0].reason), /Action: \*\*Log-only \(test\)\*\*/);
});

test('multiple attachments scan each but delete and report only once', async () => {
  const harness = makeProcessor({});
  const results = [predictions(0.05), predictions(0.7), predictions(0.95)];
  let i = 0;
  const classify = async (t: FakeTensor) => {
    harness.model.lastTensor = t;
    return results[Math.min(i++, results.length - 1)];
  };
  (harness.model as { classify: unknown }).classify = classify;

  const { app, reports } = makeApp();
  const service = await makeReadyService(app, harness.processor, harness.model);

  const { msg, deleteCalls } = makeMessage({
    attachments: [attachment('a1'), attachment('a2', 'mid.png'), attachment('a3', 'worst.png')],
  });
  await service.handleMessage(msg);
  await settle();

  assert.equal(deleteCalls.length, 1, 'delete at most once');
  assert.equal(reports.length, 1, 'report at most once');
  assert.equal(harness.tf.tensors.length, 3, 'each attachment scanned');
  assert.match(String(reports[0].reason), /worst\.png/, 'worst offender reported');
  assert.match(String(reports[0].reason), /Action: \*\*Deleted\*\*/);
});

test('duplicate handleMessage for the same message is ignored', async () => {
  const harness = makeProcessor({});
  harness.setPredictions(predictions(0.9));
  const { app, reports } = makeApp();
  const service = await makeReadyService(app, harness.processor, harness.model);

  const { msg, deleteCalls } = makeMessage({ attachments: [attachment('a1')] });
  await service.handleMessage(msg);
  await service.handleMessage(msg); // duplicate — ignored
  await settle();

  assert.equal(deleteCalls.length, 1);
  assert.equal(reports.length, 1);
});

// ---------------------------------------------------------------------------
// Service: gating
// ---------------------------------------------------------------------------

test('ignored channels are skipped', async () => {
  const harness = makeProcessor({});
  harness.setPredictions(predictions(0.99));
  const { app, reports } = makeApp({ config: { ignored_channels: ['chan-1'] } });
  const service = await makeReadyService(app, harness.processor, harness.model);

  const { msg } = makeMessage({ attachments: [attachment('a1')] });
  await service.handleMessage(msg);
  await settle();

  assert.equal(reports.length, 0);
  assert.equal(harness.tf.tensors.length, 0, 'no inference ran');
});

test('exempt roles are skipped', async () => {
  const harness = makeProcessor({});
  harness.setPredictions(predictions(0.99));
  const { app, reports } = makeApp({ config: { exempt_roles: ['role-x'] } });
  const service = await makeReadyService(app, harness.processor, harness.model);

  const { msg } = makeMessage({ attachments: [attachment('a1')], memberRoles: ['role-x'] });
  await service.handleMessage(msg);
  await settle();

  assert.equal(reports.length, 0);
  assert.equal(harness.tf.tensors.length, 0);
});

test('bots, webhooks, DMs and non-image attachments are ignored', async () => {
  const harness = makeProcessor({});
  harness.setPredictions(predictions(0.99));
  const { app, reports } = makeApp();
  const service = await makeReadyService(app, harness.processor, harness.model);

  const bot = makeMessage({ attachments: [attachment('a1')], bot: true });
  const webhook = makeMessage({ attachments: [attachment('a1')], webhookId: 'wh-1' });
  const dm = makeMessage({ attachments: [attachment('a1')], inGuild: false });
  const text = makeMessage({
    attachments: [attachment('a1', 'notes.txt', 'https://cdn.discordapp.com/attachments/c/m/notes.txt', 'text/plain')],
  });

  await service.handleMessage(bot.msg);
  await service.handleMessage(webhook.msg);
  await service.handleMessage(dm.msg);
  await service.handleMessage(text.msg);
  await settle();

  assert.equal(reports.length, 0);
  assert.equal(harness.tf.tensors.length, 0);
});

test('messages outside configured guilds are ignored', async () => {
  const harness = makeProcessor({});
  harness.setPredictions(predictions(0.99));
  const { app, reports } = makeApp({ config: { guilds: ['guild-2'] } });
  const service = await makeReadyService(app, harness.processor, harness.model);

  const { msg } = makeMessage({ guildId: 'guild-1', attachments: [attachment('a1')] });
  await service.handleMessage(msg);
  await settle();

  assert.equal(reports.length, 0);
});

// ---------------------------------------------------------------------------
// Service: failure handling
// ---------------------------------------------------------------------------

test('oversized attachment is rejected with no action', async () => {
  const harness = makeProcessor({ fetchBehavior: { kind: 'ok', contentLength: 11 * 1024 * 1024 } });
  harness.setPredictions(predictions(0.99));
  const { app, reports, warns } = makeApp({ config: { max_attachment_bytes: 10 * 1024 * 1024 } });
  const service = await makeReadyService(app, harness.processor, harness.model);

  const { msg, deleteCalls } = makeMessage({ attachments: [attachment('a1')] });
  await service.handleMessage(msg);
  await settle();

  assert.equal(reports.length, 0);
  assert.equal(deleteCalls.length, 0);
  assert.ok(warns.some((w) => w.includes('exceeds size limit')), 'oversize logged');
});

test('download timeout is handled without punishing anyone', async () => {
  const harness = makeProcessor({ fetchBehavior: { kind: 'hang', abortable: true } });
  const { app, reports, warns } = makeApp({ config: { download_timeout_ms: 5 } });
  const service = await makeReadyService(app, harness.processor, harness.model);

  const { msg, deleteCalls } = makeMessage({ attachments: [attachment('a1')] });
  await service.handleMessage(msg);
  await settle();

  assert.equal(reports.length, 0);
  assert.equal(deleteCalls.length, 0);
  assert.ok(warns.some((w) => w.includes('timed out')), 'timeout logged');
});

test('untrusted attachment host is rejected', async () => {
  const harness = makeProcessor({});
  const { app, reports, warns } = makeApp();
  const service = await makeReadyService(app, harness.processor, harness.model);

  const { msg } = makeMessage({
    attachments: [{ id: 'a1', name: 'x.png', url: 'https://evil.example.com/x.png', contentType: 'image/png' }],
  });
  await service.handleMessage(msg);
  await settle();

  assert.equal(reports.length, 0);
  assert.ok(warns.some((w) => w.includes('untrusted attachment host')));
});

test('extreme dimensions are rejected before inference', async () => {
  const harness = makeProcessor({ sharpMeta: { width: 50000, height: 50000 } });
  const { app, reports, warns } = makeApp();
  const service = await makeReadyService(app, harness.processor, harness.model);

  const { msg } = makeMessage({ attachments: [attachment('a1')] });
  await service.handleMessage(msg);
  await settle();

  assert.equal(reports.length, 0);
  assert.equal(harness.tf.tensors.length, 0, 'no tensor created for rejected image');
  assert.ok(warns.some((w) => w.includes('dimensions')));
});

test('full queue drops the message without crashing', async () => {
  const harness = makeProcessor({ fetchBehavior: { kind: 'hang', abortable: true } });
  const { app, reports, warns } = makeApp({ config: { queue_capacity: 1, download_timeout_ms: 100 } });
  const service = await makeReadyService(app, harness.processor, harness.model);

  await service.handleMessage(makeMessage({ id: 'msg-1', attachments: [attachment('a1')] }).msg); // in flight
  await service.handleMessage(makeMessage({ id: 'msg-2', attachments: [attachment('a2')] }).msg); // queued
  await service.handleMessage(makeMessage({ id: 'msg-3', attachments: [attachment('a3')] }).msg); // rejected
  await settle();

  assert.ok(warns.some((w) => w.includes('queue full')), 'overflow logged');
  assert.equal(reports.length, 0);
});

test('model load failure disables moderation instead of crashing', async () => {
  const harness = makeProcessor({});
  const reportErrors: string[] = [];
  const { app, reports } = makeApp({ reportError: (err) => reportErrors.push((err as Error).message) });
  const service = new NsfwModerationService(app as never, { processor: harness.processor });
  await service.init(async () => {
    throw new Error('model download failed');
  });

  const { msg } = makeMessage({ attachments: [attachment('a1')] });
  await service.handleMessage(msg);
  await settle();

  assert.equal(reports.length, 0, 'no jobs run without a model');
  assert.equal(reportErrors.length, 1, 'model failure reported via logManager');
});

test('classifier failure releases the tensor and takes no action', async () => {
  const tf = fakeTf();
  const model = {
    classify: async () => {
      throw new Error('inference exploded');
    },
  };
  const processor = new NsfwImageProcessor({
    tf: tf.module,
    sharp: fakeSharp(),
    fetchImpl: fakeFetch({ kind: 'ok' }) as never,
    getModel: async () => makeClassifier(model) as never,
  });
  const { app, reports, warns } = makeApp();
  const service = await makeReadyService(app, processor, model);

  const { msg } = makeMessage({ attachments: [attachment('a1')] });
  await service.handleMessage(msg);
  await settle();

  assert.equal(reports.length, 0);
  assert.equal(tf.tensors.length, 1);
  assert.equal(tf.tensors[0].disposed, true, 'tensor disposed even when classify throws');
  assert.ok(warns.some((w) => w.includes('inference exploded')));
});

test('report creation failure is caught and logged', async () => {
  const harness = makeProcessor({});
  harness.setPredictions(predictions(0.9));
  const { app, reports, errors } = makeApp();
  app.reporting.createReport = async () => {
    throw new Error('report insert failed');
  };
  const service = await makeReadyService(app, harness.processor, harness.model);

  const { msg, deleteCalls } = makeMessage({ attachments: [attachment('a1')] });
  await service.handleMessage(msg);
  await settle();

  assert.equal(deleteCalls.length, 1, 'deletion still attempted');
  assert.equal(reports.length, 0);
  assert.ok(errors.some((e) => e.includes('report failed')));
});

test('missing delete permission reports delete_failed without deleting', async () => {
  const harness = makeProcessor({});
  harness.setPredictions(predictions(0.9));
  const { app, reports } = makeApp();
  const service = await makeReadyService(app, harness.processor, harness.model);

  const { msg, deleteCalls } = makeMessage({ attachments: [attachment('a1')], deletable: false });
  await service.handleMessage(msg);
  await settle();

  assert.equal(deleteCalls.length, 0);
  assert.equal(reports.length, 1);
  assert.match(String(reports[0].reason), /could not be deleted/);
  assert.match(String(reports[0].reason), /Action: \*\*Delete failed\*\*/);
});

test('shutdown stops accepting jobs', async () => {
  const harness = makeProcessor({});
  harness.setPredictions(predictions(0.9));
  const { app } = makeApp();
  const service = await makeReadyService(app, harness.processor, harness.model);

  await service.shutdown();
  const { msg, deleteCalls } = makeMessage({ attachments: [attachment('a1')] });
  await service.handleMessage(msg);
  await settle();

  assert.equal(deleteCalls.length, 0);
  assert.equal(harness.tf.tensors.length, 0, 'no new jobs after shutdown');
});

// ---------------------------------------------------------------------------
// Ignored categories
// ---------------------------------------------------------------------------

test('ignored_categories exclude classes from explicit score', async () => {
  const harness = makeProcessor({});
  harness.setPredictions([
    { className: 'Porn', probability: 0.4 },
    { className: 'Hentai', probability: 0.3 },
    { className: 'Neutral', probability: 0.2 },
    { className: 'Drawing', probability: 0.05 },
    { className: 'Sexy', probability: 0.05 },
  ]);
  // raw = 0.7, but ignored_categories removes Hentai → effective = 0.4 → below review
  const { app, reports } = makeApp({ config: { ignored_categories: ['Hentai'] } });
  const service = await makeReadyService(app, harness.processor, harness.model);

  const { msg, deleteCalls } = makeMessage({ attachments: [attachment('a1')] });
  await service.handleMessage(msg);
  await settle();

  assert.equal(reports.length, 0, 'below review after filtering');
  assert.equal(deleteCalls.length, 0);
  assert.equal(harness.tf.tensors.length, 1, 'tensor still disposed');
});

test('ignored_categories reported in the report reason', async () => {
  const harness = makeProcessor({});
  harness.setPredictions([
    { className: 'Porn', probability: 0.65 },
    { className: 'Hentai', probability: 0.2 },
    { className: 'Neutral', probability: 0.1 },
    { className: 'Drawing', probability: 0.03 },
    { className: 'Sexy', probability: 0.02 },
  ]);
  // raw = 0.85, filtered (ignore Hentai) = 0.65 → review at 0.6 threshold
  const { app, reports } = makeApp({ config: { ignored_categories: ['Hentai'], review_threshold: 0.6 } });
  const service = await makeReadyService(app, harness.processor, harness.model);

  const { msg } = makeMessage({ attachments: [attachment('a1')] });
  await service.handleMessage(msg);
  await settle();

  assert.equal(reports.length, 1);
  const reason = String(reports[0].reason);
  assert.match(reason, /Explicit \(Porn \+ Hentai, filtered\): \*\*65\.00%\*\*/);
  assert.match(reason, /raw: 85\.00%/);
  assert.match(reason, /Ignored categories: Hentai/);
});

test('all explicit categories ignored yields score 0', async () => {
  const harness = makeProcessor({});
  harness.setPredictions([
    { className: 'Porn', probability: 0.95 },
    { className: 'Hentai', probability: 0.03 },
    { className: 'Neutral', probability: 0.02 },
  ]);
  const { app, reports } = makeApp({ config: { ignored_categories: ['Porn', 'Hentai'] } });
  const service = await makeReadyService(app, harness.processor, harness.model);

  const { msg } = makeMessage({ attachments: [attachment('a1')] });
  await service.handleMessage(msg);
  await settle();

  assert.equal(reports.length, 0, 'both explicit classes ignored → score 0');
});

// ---------------------------------------------------------------------------
// Automod ignore inheritance
// ---------------------------------------------------------------------------

test('automod channel_ignore_list is inherited', async () => {
  const harness = makeProcessor({});
  harness.setPredictions(predictions(0.99));
  const { app, reports } = makeApp({
    automod: {
      global_immune_roles: [],
      modules: {
        spam: { channel_ignore_list: ['chan-1'], immune_roles: [] },
        regex: { channel_ignore_list: ['chan-99'], immune_roles: [] },
      },
    },
  });
  const service = await makeReadyService(app, harness.processor, harness.model);

  const { msg } = makeMessage({ attachments: [attachment('a1')] });
  await service.handleMessage(msg);
  await settle();

  assert.equal(reports.length, 0, 'channel in automod ignore list → skipped');
  assert.equal(harness.tf.tensors.length, 0);
});

test('automod global_immune_roles are inherited', async () => {
  const harness = makeProcessor({});
  harness.setPredictions(predictions(0.99));
  const { app, reports } = makeApp({
    automod: {
      global_immune_roles: ['staff-role-1'],
      modules: {},
    },
  });
  const service = await makeReadyService(app, harness.processor, harness.model);

  const { msg } = makeMessage({
    attachments: [attachment('a1')],
    memberRoles: ['staff-role-1'],
  });
  await service.handleMessage(msg);
  await settle();

  assert.equal(reports.length, 0, 'global immune role → skipped');
});

test('automod per-module immune_roles are inherited', async () => {
  const harness = makeProcessor({});
  harness.setPredictions(predictions(0.99));
  const { app, reports } = makeApp({
    automod: {
      global_immune_roles: [],
      modules: {
        spam: { channel_ignore_list: [], immune_roles: ['mod-role-x'] },
      },
    },
  });
  const service = await makeReadyService(app, harness.processor, harness.model);

  const { msg } = makeMessage({
    attachments: [attachment('a1')],
    memberRoles: ['mod-role-x'],
  });
  await service.handleMessage(msg);
  await settle();

  assert.equal(reports.length, 0, 'per-module immune role → skipped');
});