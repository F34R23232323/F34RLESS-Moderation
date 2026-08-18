export type PlaceholderContext = Record<string, string | number | null | undefined>;

export function renderPlaceholders(template: string, ctx: PlaceholderContext): string {
  return template.replace(/\$?\{([a-zA-Z0-9_.]+)\}/g, (match, key: string) => {
    if (key === 'nowtimestamp') return String(Math.floor(Date.now() / 1000));
    const value = ctx[key];
    if (value === undefined || value === null) return match;
    return String(value);
  });
}

export function listMissingPlaceholders(template: string, ctx: PlaceholderContext): string[] {
  const missing: string[] = [];
  template.replace(/\{([a-zA-Z0-9_.]+)\}/g, (match, key: string) => {
    if (ctx[key] === undefined || ctx[key] === null) missing.push(key);
    return match;
  });
  return missing;
}