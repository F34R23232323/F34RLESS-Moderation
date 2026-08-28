import { loadConfig, buildDatabaseUrl, createDbPool } from '../shared/src/index';
import type { RowDataPacket } from 'mysql2/promise';

const APPLY = process.argv.includes('--apply');

interface SelectComp {
  id: string;
  placeholder?: string;
  minValues?: number;
  maxValues?: number;
  options: Array<{ label: string; value: string }>;
}

function findSelects(node: unknown, out: SelectComp[]): void {
  if (Array.isArray(node)) {
    for (const item of node) findSelects(item, out);
    return;
  }
  if (node && typeof node === 'object') {
    const obj = node as Record<string, unknown>;
    if (obj.type === 'select') {
      out.push({
        id: String(obj.id ?? ''),
        placeholder: typeof obj.placeholder === 'string' ? obj.placeholder : undefined,
        minValues: typeof obj.minValues === 'number' ? obj.minValues : undefined,
        maxValues: typeof obj.maxValues === 'number' ? obj.maxValues : undefined,
        options: Array.isArray(obj.options)
          ? (obj.options as Array<{ label: string; value: string }>).map((o) => ({ label: String(o?.label ?? ''), value: String(o?.value ?? '') }))
          : [],
      });
      return;
    }
    for (const key of Object.keys(obj)) findSelects(obj[key], out);
  }
}

const MULTI_HINTS = [
  /\b(select|choose|pick|selecting)\s+(all|multiple|any|more than one|one or more)\b/i,
  /\ball\s+that\s+apply\b/i,
  /\b(as many|one or more)\b/i,
  /\b(multiple|multi)\b/i,
  /\b(roles|permissions|features|preferences|interests|topics|options)\b/i,
  /\b(all)\b/i,
];

function needsMulti(comp: SelectComp): boolean {
  if ((comp.maxValues ?? 1) > 1) return false;
  const text = [comp.placeholder ?? '', ...comp.options.map((o) => `${o.label} ${o.value}`)].join(' ').toLowerCase();
  return MULTI_HINTS.some((re) => re.test(text));
}

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v));
}

async function main(): Promise<void> {
  const { env } = loadConfig();
  const db = createDbPool(buildDatabaseUrl(env));

  try {
    const [rows] = await db.query<RowDataPacket[]>('SELECT id, guild_id, name, kind, payload FROM saved_messages ORDER BY id ASC');

    let totalSelects = 0;
    let changedMessages = 0;
    let changedSelects = 0;

    for (const raw of rows) {
      const id = Number(raw.id);
      const name = String(raw.name ?? '');
      let payload: unknown;
      try {
        payload = JSON.parse(String(raw.payload));
      } catch {
        console.log(`#${id} ${name} — SKIPPED (invalid payload JSON)`);
        continue;
      }

      const selects: SelectComp[] = [];
      findSelects(payload, selects);
      if (selects.length === 0) continue;
      totalSelects += selects.length;

      const toChange = selects.filter((c) => needsMulti(c));
      if (toChange.length === 0) {
        console.log(`#${id} ${name} — ${selects.length} select(s), none need multi-select`);
        continue;
      }

      console.log(`\n#${id} ${name} [${raw.kind}] — ${toChange.length}/${selects.length} select(s) to make multi-select:`);
      for (const comp of toChange) {
        console.log(`   - id=${comp.id || '(none)'} placeholder="${comp.placeholder || ''}" min=${comp.minValues ?? 1} max=${comp.maxValues ?? 1}`);
        console.log(`     options: ${comp.options.map((o) => o.label).join(' | ')}`);
      }

      if (APPLY) {
        const updated = clone(payload);
        for (const comp of toChange) {
          const target = findInTree(updated, comp.id);
          if (!target) continue;
          target.minValues = 1;
          target.maxValues = Math.min(25, Math.max(2, (target.options?.length ?? 2) || 2));
        }
        await db.execute('UPDATE saved_messages SET payload = ?, updated_at = NOW() WHERE id = ?', [JSON.stringify(updated), id]);
        changedMessages++;
        changedSelects += toChange.length;
        console.log(`   -> UPDATED (max=${Math.min(25, Math.max(2, toChange[0].options?.length ?? 2) || 2)})`);
      }
    }

    console.log(`\n=== Summary ===`);
    console.log(`Total saved messages with selects: ${rows.length > 0 ? rows.length : 0} scanned`);
    console.log(`Total select menus found: ${totalSelects}`);
    if (APPLY) {
      console.log(`Messages updated: ${changedMessages}`);
      console.log(`Selects updated: ${changedSelects}`);
    } else {
      console.log(`DRY RUN — nothing was written. Re-run with --apply to write changes.`);
    }
  } finally {
    await db.end();
  }
}

function findInTree(node: unknown, compId: string): { minValues?: number; maxValues?: number; options?: Array<{ label: string; value: string }> } | null {
  if (Array.isArray(node)) {
    for (const item of node) {
      const found = findInTree(item, compId);
      if (found) return found;
    }
    return null;
  }
  if (node && typeof node === 'object') {
    const obj = node as Record<string, unknown>;
    if (obj.type === 'select' && String(obj.id ?? '') === compId) return obj as never;
    for (const key of Object.keys(obj)) {
      const found = findInTree(obj[key], compId);
      if (found) return found;
    }
  }
  return null;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});