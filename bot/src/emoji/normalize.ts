import { getLiveEmoji } from './catalog';

const customEmojiPattern = /<(a?):([A-Za-z0-9_]{2,32}):(\d{17,20})>/g;
const excludedStringKeys = new Set(['custom_id', 'url', 'proxy_url', 'icon_url', 'attachment', 'filename']);

export function normalizeEmojiMarkup(value: string): string {
  return value.replace(customEmojiPattern, (original, _staleAnimation: string, name: string) => {
    const resolved = getLiveEmoji(name);
    if (!resolved) return original;
    return `<${resolved.animated ? 'a' : ''}:${resolved.name}:${resolved.id}>`;
  });
}

export function normalizeDiscordPayload<T>(payload: T): T {
  return normalizeValue(payload, null) as T;
}

function normalizeValue(value: unknown, parentKey: string | null): unknown {
  if (typeof value === 'string') return excludedStringKeys.has(parentKey ?? '') ? value : normalizeEmojiMarkup(value);
  if (Array.isArray(value)) return value.map((item) => normalizeValue(item, parentKey));
  if (!isPlainObject(value)) return value;

  const normalized: Record<string, unknown> = {};
  for (const [property, child] of Object.entries(value)) {
    if (property === 'emoji') {
      normalized[property] = normalizeComponentEmoji(child);
    } else {
      normalized[property] = normalizeValue(child, property);
    }
  }
  return normalized;
}

function normalizeComponentEmoji(value: unknown): unknown {
  if (typeof value === 'string') {
    const markup = /^<(?:a?):([A-Za-z0-9_]{2,32}):\d{17,20}>$/.exec(value);
    const resolved = getLiveEmoji(markup?.[1] ?? value);
    return resolved ? { id: resolved.id, name: resolved.name, animated: resolved.animated } : value;
  }
  if (!isPlainObject(value) || typeof value.name !== 'string') return normalizeValue(value, 'emoji');
  const resolved = getLiveEmoji(value.name);
  return resolved ? { ...value, id: resolved.id, name: resolved.name, animated: resolved.animated } : normalizeValue(value, 'emoji');
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object') return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}
