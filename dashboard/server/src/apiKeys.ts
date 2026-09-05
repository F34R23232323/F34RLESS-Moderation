/**
 * External-bot API key configuration.
 *
 * A single API key is configured server-side via the `API_KEYS` environment
 * variable. External bots send it in the `Authorization: Bearer <key>` header.
 */

export function parseApiKey(raw: string | undefined): string | null {
  if (!raw) return null;
  const key = raw.trim();
  return key.length > 0 ? key : null;
}

/**
 * Constant-time check that the provided secret matches the configured API key.
 * Returns true only when a key is configured and matches.
 */
export function matchesApiKey(configured: string | null, secret: string | null): boolean {
  if (!configured || !secret) return false;
  const a = Buffer.from(configured);
  const b = Buffer.from(String(secret));
  if (a.length !== b.length) return false;
  return require('crypto').timingSafeEqual(a, b);
}
