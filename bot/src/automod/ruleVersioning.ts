import type { RowDataPacket } from 'mysql2/promise';
import { parseJson } from '../../../shared/src/index';
import type { App } from '../core/context';

export interface RuleVersionInfo {
  id: number;
  version: number;
  config: unknown;
  createdAt: Date;
}

export class RuleVersioning {
  private readonly app: App;

  constructor(app: App) {
    this.app = app;
  }

  public async saveVersion(
    guildId: string,
    module: string,
    name: string,
    config: unknown,
    createdBy?: string | null,
  ): Promise<number> {
    const [rows] = await this.app.db.query<RowDataPacket[]>(
      'SELECT COALESCE(MAX(version), 0) + 1 AS max FROM automod_rule_versions WHERE guild_id = ? AND module = ? AND name = ?',
      [guildId, module, name],
    );
    const version = rows[0]?.max ?? 1;
    await this.app.db.execute(
      `INSERT INTO automod_rule_versions (guild_id, module, name, version, config, created_by)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [guildId, module, name, version, JSON.stringify(config), createdBy ?? null],
    );
    await this.app.db.execute(
      `INSERT INTO automod_rules (guild_id, module, name, current_version, enabled)
       VALUES (?, ?, ?, ?, 1)
       ON DUPLICATE KEY UPDATE current_version = VALUES(current_version), enabled = 1`,
      [guildId, module, name, version],
    );
    return version;
  }

  public async listVersions(guildId: string, module: string, name: string): Promise<RuleVersionInfo[]> {
    const [rows] = await this.app.db.query<RowDataPacket[]>(
      'SELECT id, version, config, created_at FROM automod_rule_versions WHERE guild_id = ? AND module = ? AND name = ? ORDER BY version DESC',
      [guildId, module, name],
    );
    return rows.map((r) => ({ id: r.id, version: r.version, config: parseJson(r.config, {}), createdAt: r.created_at }));
  }

  public async rollback(guildId: string, module: string, name: string, targetVersion: number): Promise<unknown> {
    const [rows] = await this.app.db.query<RowDataPacket[]>(
      'SELECT config FROM automod_rule_versions WHERE guild_id = ? AND module = ? AND name = ? AND version = ?',
      [guildId, module, name, targetVersion],
    );
    const row = rows[0];
    if (!row) throw new Error('Version not found');
    const config = parseJson(row.config, {});
    const newVersion = await this.saveVersion(guildId, module, name, config);
    return { config, version: newVersion };
  }
}