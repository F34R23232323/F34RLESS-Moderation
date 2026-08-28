import { readFileSync } from 'node:fs';
import yaml from 'yaml';
import { CASES as C1 } from './regex-cases2.mjs';
import { CASES as C2 } from './regex-cases.mjs';

const CASES = { ...C1, ...C2 };

const cfg = yaml.parse(readFileSync(new URL('../config.yml', import.meta.url), 'utf8'));
const rules = cfg.regex_engine.rules;

const ruleByName = new Map(rules.map((r) => [r.name, r]));

let failures = 0;
let total = 0;

for (const rule of rules) {
  for (const p of rule.patterns || []) {
    try {
      new RegExp(p, rule.flags);
    } catch (err) {
      failures++;
      console.log(`[COMPILE ERROR] ${rule.name}: /${p}/${rule.flags} -> ${err.message}`);
    }
  }
}

function runRule(name) {
  const rule = ruleByName.get(name);
  if (!rule) {
    failures++;
    console.log(`  [NO RULE] no rule named "${name}"`);
    return;
  }
  const patterns = rule.patterns || [];
  for (const should of CASES[name].shouldMatch) {
    total++;
    const ok = patterns.some((p) => {
      try {
        return new RegExp(p, rule.flags).test(should);
      } catch {
        return false;
      }
    });
    if (!ok) failures++, console.log(`  [MISSED] ${name} should match: ${JSON.stringify(should)}`);
  }
  for (const shouldNot of CASES[name].shouldNotMatch) {
    total++;
    const ok = patterns.some((p) => {
      try {
        return new RegExp(p, rule.flags).test(shouldNot);
      } catch {
        return false;
      }
    });
    if (ok) failures++, console.log(`  [FALSE POSITIVE] ${name} should NOT match: ${JSON.stringify(shouldNot)}`);
  }
}

for (const name of Object.keys(CASES)) runRule(name);

console.log(`\n${total} tests run, ${failures} failures.`);
process.exit(failures > 0 ? 1 : 0);
