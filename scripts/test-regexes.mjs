import { readFileSync } from 'node:fs';
import yaml from 'yaml';
import { CASES as C1 } from './regex-cases2.mjs';
import { CASES as C2 } from './regex-cases.mjs';
import { CASES as C3 } from './regex-cases3.mjs';

const CASES = { ...C1, ...C2, ...C3 };

const cfg = yaml.parse(readFileSync(new URL('../config.yml', import.meta.url), 'utf8'));
const rules = cfg.regex_engine.rules;

const ruleByName = new Map(rules.map((r) => [r.name, r]));

let failures = 0;
let total = 0;

// ── Luhn helpers (mirrors bot/src/automod/modules/regexEngine.ts) ──────────
function luhnValid(digits) {
  let sum = 0, double = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = digits.charCodeAt(i) - 48;
    if (double) { d *= 2; if (d > 9) d -= 9; }
    sum += d; double = !double;
  }
  return sum % 10 === 0;
}
function hasValidCardIssuer(digits) {
  const p2 = digits.slice(0, 2);
  if (digits.length === 15) return p2 === '34' || p2 === '37';
  if (digits.length !== 16) return false;
  if (digits[0] === '4') return true;
  if (/^5[1-5]/.test(digits)) return true;
  const p4 = Number(digits.slice(0, 4));
  if (p4 >= 2221 && p4 <= 2720) return true;
  if (digits.startsWith('6011') || digits.startsWith('65')) return true;
  const p3 = Number(digits.slice(0, 3));
  if (p3 >= 644 && p3 <= 649) return true;
  const p6 = Number(digits.slice(0, 6));
  if (p6 >= 622126 && p6 <= 622925) return true;
  return p4 >= 3528 && p4 <= 3589;
}
function isValidCardNumber(raw) {
  const digits = raw.replace(/[^0-9]/g, '');
  if (digits.length < 15 || digits.length > 16) return false;
  return luhnValid(digits) && hasValidCardIssuer(digits);
}
function containsValidCardNumber(text) {
  const re = /\d[\d \-]{13,18}/g;
  let m;
  while ((m = re.exec(text)) !== null) if (isValidCardNumber(m[0])) return true;
  return false;
}

// Extract the regex source from either a string entry or a {pattern,luhn} object.
function srcOf(entry) {
  return typeof entry === 'string' ? entry : entry.pattern;
}

// Does this single pattern entry match `text`, honouring the luhn gate?
function matchesEntry(entry, flags, text) {
  let re;
  try { re = new RegExp(srcOf(entry), flags); } catch { return false; }
  re.lastIndex = 0;
  if (!re.test(text)) return false;
  if (typeof entry === 'object' && entry.luhn && !containsValidCardNumber(text)) return false;
  return true;
}

// Compile-check every pattern (using the real source, not the object).
for (const rule of rules) {
  const entries = [...(rule.patterns || []), ...(rule.pattern ? [rule.pattern] : [])];
  for (const p of entries) {
    try {
      new RegExp(srcOf(p), rule.flags);
    } catch (err) {
      failures++;
      console.log(`[COMPILE ERROR] ${rule.name}: /${srcOf(p)}/${rule.flags} -> ${err.message}`);
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
  const patterns = [...(rule.patterns || []), ...(rule.pattern ? [rule.pattern] : [])];
  if (patterns.length === 0) {
    failures++;
    console.log(`  [NO PATTERNS] ${name} has no patterns`);
    return;
  }
  for (const should of CASES[name].shouldMatch) {
    total++;
    const ok = patterns.some((p) => matchesEntry(p, rule.flags, should));
    if (!ok) failures++, console.log(`  [MISSED] ${name} should match: ${JSON.stringify(should)}`);
  }
  for (const shouldNot of CASES[name].shouldNotMatch) {
    total++;
    const ok = patterns.some((p) => matchesEntry(p, rule.flags, shouldNot));
    if (ok) failures++, console.log(`  [FALSE POSITIVE] ${name} should NOT match: ${JSON.stringify(shouldNot)}`);
  }
}

for (const name of Object.keys(CASES)) runRule(name);

// Report any config rule that has no test coverage.
const untested = rules.filter((r) => !CASES[r.name]).map((r) => r.name);
if (untested.length > 0) {
  console.log(`\n[UNTESTED] ${untested.length} rule(s) have no cases: ${untested.join(', ')}`);
}

console.log(`\n${total} tests run, ${failures} failures.`);
process.exit(failures > 0 ? 1 : 0);
