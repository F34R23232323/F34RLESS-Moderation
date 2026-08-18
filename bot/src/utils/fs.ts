import * as fs from 'fs';
import * as path from 'path';

export function walkDir(dir: string, exts: string[] = ['.ts', '.js']): string[] {
  const out: string[] = [];
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walkDir(full, exts));
    } else if (entry.isFile() && exts.some((e) => entry.name.endsWith(e)) && !entry.name.endsWith('.d.ts')) {
      out.push(full);
    }
  }
  return out;
}

export async function importFiles<T>(dir: string): Promise<T[]> {
  const files = walkDir(dir);
  const items: T[] = [];
  for (const file of files) {
    try {
      const mod = await import(file);
      const value = (mod.default ?? mod) as T;
      items.push(value);
    } catch (err) {
      console.error(`Failed to import ${file}:`, err);
    }
  }
  return items;
}