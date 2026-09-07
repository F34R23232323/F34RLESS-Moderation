import type { Pool, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { antiNukeConfigSchema, balancedAntiNukeConfig, type AntiNukeConfig } from '../schemas/config';

interface ConfigRow extends RowDataPacket { version: number; config_json: unknown }

export class ConfigService {
  public constructor(private readonly db: Pool) {}

  public async get(guildId: string): Promise<{ config: AntiNukeConfig; version: number }> {
    const [rows] = await this.db.query<ConfigRow[]>('SELECT version, config_json FROM antinuke_configs WHERE guild_id = ? LIMIT 1', [guildId]);
    const row = rows[0];
    if (!row) return { config: balancedAntiNukeConfig, version: 0 };
    const raw = typeof row.config_json === 'string' ? JSON.parse(row.config_json) as unknown : row.config_json;
    return { config: antiNukeConfigSchema.parse(raw), version: Number(row.version) };
  }

  public async update(guildId: string, actorId: string, expectedVersion: number, input: unknown, action: string): Promise<{ config: AntiNukeConfig; version: number }> {
    const config = antiNukeConfigSchema.parse(input);
    const connection = await this.db.getConnection();
    try {
      await connection.beginTransaction();
      const [rows] = await connection.query<ConfigRow[]>('SELECT version, config_json FROM antinuke_configs WHERE guild_id = ? FOR UPDATE', [guildId]);
      const current = rows[0];
      const currentVersion = current ? Number(current.version) : 0;
      if (currentVersion !== expectedVersion) throw new Error('Configuration changed after preview');
      const nextVersion = currentVersion + 1;
      const previousJson = current?.config_json ?? null;
      const [result] = await connection.execute<ResultSetHeader>(
        `INSERT INTO antinuke_configs (guild_id, version, schema_version, enabled, setup_completed_at, config_json, updated_by)
         VALUES (?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE version = VALUES(version), schema_version = VALUES(schema_version),
         enabled = VALUES(enabled), setup_completed_at = VALUES(setup_completed_at), config_json = VALUES(config_json), updated_by = VALUES(updated_by)`,
        [guildId, nextVersion, config.schemaVersion, config.enabled ? 1 : 0, config.setupCompletedAt ? new Date(config.setupCompletedAt) : null, JSON.stringify(config), actorId],
      );
      if (result.affectedRows < 1) throw new Error('Configuration write failed');
      await connection.execute('INSERT INTO antinuke_config_history (guild_id, version, actor_id, action, previous_json, next_json) VALUES (?, ?, ?, ?, ?, ?)',
        [guildId, nextVersion, actorId, action.slice(0, 64), previousJson ? JSON.stringify(previousJson) : null, JSON.stringify(config)]);
      await connection.commit();
      return { config, version: nextVersion };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }
}
