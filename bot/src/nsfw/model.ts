import { lazyRequire, type NsfwClassifier, type NsfwjsModule } from './types';

let modelPromise: Promise<NsfwClassifier> | null = null;

/** Loads the NSFWJS MobileNetV2 model exactly once per process and reuses the
 *  same instance for every image. Rejects are surfaced to the caller (init)
 *  and cached nulled so a later init can retry. */
export function loadNsfwModel(): Promise<NsfwClassifier> {
  if (!modelPromise) {
    const nsfwjs = lazyRequire<NsfwjsModule>('nsfwjs');
    modelPromise = nsfwjs.load();
    modelPromise.catch(() => {
      modelPromise = null;
    });
  }
  return modelPromise;
}

/** Best-effort disposal of the underlying graph model (nsfwjs does not
 *  document a public dispose — guarded so missing support is harmless). */
export function disposeNsfwModel(): void {
  const promise = modelPromise;
  modelPromise = null;
  if (!promise) return;
  void promise
    .then((model) => {
      const m = model as unknown as { dispose?: () => void; model?: { dispose?: () => void } };
      try {
        m.dispose?.();
      } catch {
        // ignore
      }
      try {
        m.model?.dispose?.();
      } catch {
        // ignore
      }
    })
    .catch(() => undefined);
}