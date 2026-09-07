export interface LiveEmoji {
  readonly id: string;
  readonly name: string;
  readonly animated: boolean;
}

const liveEmojis = new Map<string, LiveEmoji>();
let ready = false;

function key(name: string): string {
  return name.trim().toLowerCase();
}

export function replaceEmojiCatalog(emojis: Iterable<LiveEmoji>): void {
  liveEmojis.clear();
  for (const emoji of emojis) liveEmojis.set(key(emoji.name), emoji);
  ready = true;
}

export function isEmojiCatalogReady(): boolean {
  return ready;
}

export function getLiveEmoji(name: string): LiveEmoji | null {
  if (!ready) return null;
  return liveEmojis.get(key(name)) ?? null;
}

export function emoji(name: string): string {
  const resolved = getLiveEmoji(name);
  if (!resolved) return '';
  return `<${resolved.animated ? 'a' : ''}:${resolved.name}:${resolved.id}>`;
}

export function emojiPrefix(name: string): string {
  const formatted = emoji(name);
  return formatted ? `${formatted} ` : '';
}

export function applicationEmoji(name: string): { id: string; name: string; animated: boolean } | undefined {
  const resolved = getLiveEmoji(name);
  return resolved ? { id: resolved.id, name: resolved.name, animated: resolved.animated } : undefined;
}

export function clearEmojiCatalogForTests(): void {
  liveEmojis.clear();
  ready = false;
}
