/** Parse a value that may be a JSON string OR an already-parsed object.
 *  mysql2 auto-parses MySQL JSON columns into JS objects, so code reading those
 *  columns must accept both forms without crashing. */
export function parseJson<T>(value: unknown, fallback: T): T {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed.length === 0) return fallback;
    try {
      return JSON.parse(trimmed) as T;
    } catch {
      return fallback;
    }
  }
  return value as T;
}