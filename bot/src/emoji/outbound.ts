import { REST } from 'discord.js';
import { normalizeDiscordPayload } from './normalize';

type RestMethod = REST['post'];
type PatchedRestPrototype = REST & { __f34rlessEmojiNormalizerInstalled?: boolean };

export function installEmojiOutboundNormalizer(): void {
  const prototype = REST.prototype as PatchedRestPrototype;
  if (prototype.__f34rlessEmojiNormalizerInstalled) return;
  patchMethod(prototype, 'post');
  patchMethod(prototype, 'patch');
  patchMethod(prototype, 'put');
  Object.defineProperty(prototype, '__f34rlessEmojiNormalizerInstalled', { value: true, configurable: false, enumerable: false, writable: false });
}

function patchMethod(prototype: REST, method: 'post' | 'patch' | 'put'): void {
  const original = prototype[method] as RestMethod;
  const replacement: RestMethod = function (this: REST, route, options = {}) {
    const normalized = { ...options, body: normalizeDiscordPayload(options.body) };
    return original.call(this, route, normalized);
  };
  Object.defineProperty(prototype, method, { value: replacement, configurable: true, writable: true });
}
