import * as fs from 'fs';
import * as YAML from 'yaml';

const c = YAML.parse(fs.readFileSync('config.yml', 'utf8')) as any;
const rules = c.regex_engine.rules.filter((r: any) => r.name.startsWith('Slurs')) as Array<{ name: string; pattern: string; flags: string; action_chain: unknown[] }>;
console.log('Slurs rules:', rules.length);

const tests = ['nigger', 'nigg3r', 'nigga', 'n1gger', 'nigg@', 'cunt', 'bastard', 'hello friend'];
for (const t of tests) {
  const matched: string[] = [];
  for (const r of rules) {
    try {
      const re = new RegExp(r.pattern, r.flags);
      if (re.test(t)) matched.push(`${r.name}`);
    } catch {
      /* ignore */
    }
  }
  console.log(JSON.stringify(t), '->', matched.length ? matched.join(' | ') : 'NO MATCH');
}
console.log('sample rule action_chain first step:', JSON.stringify(rules[0]?.action_chain?.[0]));
console.log('regex_engine enabled:', c.regex_engine.enabled, '| rules total:', c.regex_engine.rules.length);