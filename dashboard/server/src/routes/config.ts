import { Router } from 'express';
import * as fs from 'fs';
import * as YAML from 'yaml';
import type { RowDataPacket } from 'mysql2/promise';
import type { DashboardContext } from '../context';
import { configSchema, runCrossFieldChecks, DEFAULT_CONFIG_YAML, loadConfig, formatConfigError, ConfigValidationError } from '../../../../shared/src/index';

export function createConfigRouter(ctx: DashboardContext): Router {
  const router = Router();

  router.get('/', (_req, res) => {
    const configPath = process.env.CONFIG_PATH ? process.env.CONFIG_PATH : process.cwd() + '/config.yml';
    let content = '';
    if (fs.existsSync(configPath)) {
      content = fs.readFileSync(configPath, 'utf8');
    }
    res.json({ configPath, yaml: content });
  });

  router.post('/validate', (req, res) => {
    const yaml = (req.body as { yaml?: string }).yaml;
    if (!yaml) {
      res.status(400).json({ ok: false, error: 'no yaml provided' });
      return;
    }
    try {
      const parsed = YAML.parse(yaml);
      const result = configSchema.safeParse(parsed ?? {});
      const issues: unknown[] = [];
      if (!result.success) {
        for (const issue of result.error.issues) {
          issues.push({ path: issue.path.join('.'), message: issue.message });
        }
      } else {
        for (const issue of runCrossFieldChecks(result.data)) {
          issues.push(issue);
        }
      }
      res.json({ ok: issues.length === 0, issues });
    } catch (err) {
      res.json({ ok: false, issues: [{ path: '(parse)', message: (err as Error).message }] });
    }
  });

  router.post('/save', (req, res) => {
    const body = req.body as { yaml?: string; actorId?: string };
    if (!body.yaml) {
      res.status(400).json({ ok: false, error: 'no yaml provided' });
      return;
    }
    try {
      const parsed = YAML.parse(body.yaml);
      const result = configSchema.safeParse(parsed ?? {});
      if (!result.success || runCrossFieldChecks(result.success ? result.data : ({} as never)).length > 0) {
        res.status(400).json({ ok: false, error: 'config failed validation' });
        return;
      }
    } catch {
      res.status(400).json({ ok: false, error: 'config failed validation' });
      return;
    }

    const configPath = process.env.CONFIG_PATH ? process.env.CONFIG_PATH : process.cwd() + '/config.yml';
    const oldContent = fs.existsSync(configPath) ? fs.readFileSync(configPath, 'utf8') : '';
    fs.writeFileSync(configPath, body.yaml, 'utf8');

    void ctx.db.execute(
      'INSERT INTO config_audit (guild_id, actor_id, path, old_value, new_value, source) VALUES (?, ?, ?, ?, ?, ?)',
      ['0', body.actorId ?? null, configPath, JSON.stringify(oldContent), JSON.stringify(body.yaml), 'dashboard'],
    );
    res.json({ ok: true });
  });

  router.get('/default', (_req, res) => {
    res.json({ yaml: DEFAULT_CONFIG_YAML });
  });

  router.post('/reload', (_req, res) => {
    try {
      loadConfig();
      res.json({ ok: true });
    } catch (err) {
      res.json({ ok: false, error: formatConfigError(err) });
    }
  });

  router.get('/audit', async (_req, res) => {
    const [rows] = await ctx.db.query<RowDataPacket[]>(
      'SELECT id, actor_id, path, source, created_at FROM config_audit ORDER BY id DESC LIMIT 100',
    );
    res.json({ rows });
  });

  return router;
}

export { ConfigValidationError };