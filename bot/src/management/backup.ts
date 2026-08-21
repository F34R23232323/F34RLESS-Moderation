import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import type { App } from '../core/context';

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function randomCode(length: number): string {
  const bytes = crypto.randomBytes(length);
  let code = '';
  for (let i = 0; i < length; i++) {
    code += CODE_CHARS[bytes[i] % CODE_CHARS.length];
  }
  return code;
}

export async function runBackup(app: App): Promise<void> {
  const backupRoot = path.resolve(process.cwd(), 'dbbackups');
  fs.mkdirSync(backupRoot, { recursive: true });

  const now = new Date();
  const stamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}-${String(now.getSeconds()).padStart(2, '0')}`;
  const backupDir = path.join(backupRoot, `${stamp}_${randomCode(4)}`);
  fs.mkdirSync(backupDir, { recursive: true });

  const filename = `backup-${new Date().toISOString().replace(/[:.]/g, '-')}.sql`;
  const filePath = path.join(backupDir, filename);

  const { env } = app;
  const host = env.MYSQL_HOST;
  const port = env.MYSQL_PORT;
  const user = env.MYSQL_USER;
  const pass = env.MYSQL_PASSWORD;
  const db = env.MYSQL_DATABASE;

  // NOTE: In Docker the MySQL container runs mysqldump natively (see docker/
  // backup service). This in-bot fallback writes a minimal export of the
  // most important tables when mysqldump is not available.
  try {
    const tables = [
      'cases', 'warnings', 'notes', 'automod_triggers', 'reports', 'logs',
      'automod_logs', 'command_usage', 'config_audit', 'custom_commands',
    ];
    const lines: string[] = ['-- f34rless-moderation backup', `-- ${new Date().toISOString()}`];
    for (const table of tables) {
      try {
        const [rows] = await app.db.query(`SELECT * FROM ${table}`);
        const data = rows as Array<Record<string, unknown>>;
        lines.push(`-- ${table}: ${data.length} rows`);
        for (const row of data) {
          lines.push(`INSERT INTO ${table} (${Object.keys(row).join(',')}) VALUES (${Object.values(row).map((v) => JSON.stringify(v)).join(',')});`);
        }
      } catch {
        lines.push(`-- ${table}: skipped (not present)`);
      }
    }
    fs.writeFileSync(filePath, lines.join('\n'), 'utf8');
    app.logger.info(`Backup written to ${filePath}`);

    const retention = app.config.ops.backup_retention_count;
    const dirs = fs
      .readdirSync(backupRoot)
      .filter((d) => fs.statSync(path.join(backupRoot, d)).isDirectory())
      .sort()
      .reverse();
    for (const d of dirs.slice(retention)) {
      const dirPath = path.join(backupRoot, d);
      for (const f of fs.readdirSync(dirPath)) {
        fs.unlinkSync(path.join(dirPath, f));
      }
      fs.rmdirSync(dirPath);
      app.logger.info(`Removed old backup folder ${dirPath}`);
    }
  } catch (err) {
    app.logger.error('Backup failed:', err);
  }
}