import * as fs from 'fs';
import * as path from 'path';
import type { App } from '../core/context';

export async function runBackup(app: App): Promise<void> {
  const backupDir = path.resolve(process.cwd(), 'backups');
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
    const files = fs
      .readdirSync(backupDir)
      .filter((f) => f.startsWith('backup-') && f.endsWith('.sql'))
      .sort()
      .reverse();
    for (const f of files.slice(retention)) {
      fs.unlinkSync(path.join(backupDir, f));
    }
  } catch (err) {
    app.logger.error('Backup failed:', err);
  }
}