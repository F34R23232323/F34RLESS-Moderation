import * as fs from 'fs';
import * as path from 'path';
import { pathToFileURL } from 'url';

function walk(d: string): string[] {
  const out: string[] = [];
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const f = path.join(d, e.name);
    if (e.isDirectory()) out.push(...walk(f));
    else if (e.isFile() && e.name.endsWith('.ts') && !e.name.endsWith('.d.ts')) out.push(f);
  }
  return out;
}

async function main(): Promise<void> {
  const problems: string[] = [];
  let count = 0;
  for (const f of walk(path.resolve('bot/src/commands'))) {
    let mod: any;
    try {
      mod = await import(pathToFileURL(f).href);
    } catch (err) {
      problems.push(`${f}: import ${(err as Error).message}`);
      continue;
    }
    const list = Array.isArray(mod.default) ? mod.default : [mod.default];
    for (const c of list) {
      if (!c || !c.data) continue;
      count++;
      let json: any;
      try {
        json = c.data.toJSON();
      } catch (err) {
        problems.push(`${c.name}: toJSON ${(err as Error).message}`);
        continue;
      }
      const opts = json.options || [];
      const hasSub = opts.some((o: any) => o.type === 1 || o.type === 2);
      const hasPlain = opts.some((o: any) => o.type !== 1 && o.type !== 2);
      if (hasSub && hasPlain) problems.push(`${c.name}: MIXED subcommand + plain options`);
      const check = (list2: any[], name: string): void => {
        let seenOptional = false;
        for (const o of list2) {
          if (o.required !== true) seenOptional = true;
          else if (seenOptional) problems.push(`${c.name}: REQUIRED after OPTIONAL in ${name}.${o.name}`);
        }
        for (const o of list2) {
          if ((o.type === 1 || o.type === 2) && o.options) check(o.options, `${name}.${o.name}`);
        }
      };
      check(opts, json.name);
    }
  }
  console.log(`checked commands: ${count}`);
  if (problems.length === 0) console.log('All command schemas valid.');
  else problems.forEach((p) => console.log(p));
}

main().catch((err) => {
  console.error('FATAL', err);
  process.exit(1);
});