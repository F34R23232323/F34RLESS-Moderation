import * as fs from 'fs';
import * as path from 'path';
import { DEFAULT_CONFIG_YAML } from '../shared/src/config/defaultYaml';

const target = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.resolve(process.cwd(), 'config.yml');

if (fs.existsSync(target)) {
  console.log(`config.yml already exists at ${target} — leaving it untouched.`);
  process.exit(0);
}

fs.writeFileSync(target, DEFAULT_CONFIG_YAML, 'utf8');
console.log(`Wrote default config.yml to ${target}`);