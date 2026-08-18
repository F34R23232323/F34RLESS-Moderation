"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RuleVersioning = void 0;
class RuleVersioning {
    app;
    constructor(app) {
        this.app = app;
    }
    async saveVersion(guildId, module, name, config, createdBy) {
        const [rows] = await this.app.db.query('SELECT COALESCE(MAX(version), 0) + 1 AS max FROM automod_rule_versions WHERE guild_id = ? AND module = ? AND name = ?', [guildId, module, name]);
        const version = rows[0]?.max ?? 1;
        await this.app.db.execute(`INSERT INTO automod_rule_versions (guild_id, module, name, version, config, created_by)
       VALUES (?, ?, ?, ?, ?, ?)`, [guildId, module, name, version, JSON.stringify(config), createdBy ?? null]);
        await this.app.db.execute(`INSERT INTO automod_rules (guild_id, module, name, current_version, enabled)
       VALUES (?, ?, ?, ?, 1)
       ON DUPLICATE KEY UPDATE current_version = VALUES(current_version), enabled = 1`, [guildId, module, name, version]);
        return version;
    }
    async listVersions(guildId, module, name) {
        const [rows] = await this.app.db.query('SELECT id, version, config, created_at FROM automod_rule_versions WHERE guild_id = ? AND module = ? AND name = ? ORDER BY version DESC', [guildId, module, name]);
        return rows.map((r) => ({ id: r.id, version: r.version, config: JSON.parse(r.config), createdAt: r.created_at }));
    }
    async rollback(guildId, module, name, targetVersion) {
        const [rows] = await this.app.db.query('SELECT config FROM automod_rule_versions WHERE guild_id = ? AND module = ? AND name = ? AND version = ?', [guildId, module, name, targetVersion]);
        const row = rows[0];
        if (!row)
            throw new Error('Version not found');
        const config = JSON.parse(row.config);
        const newVersion = await this.saveVersion(guildId, module, name, config);
        return { config, version: newVersion };
    }
}
exports.RuleVersioning = RuleVersioning;
//# sourceMappingURL=ruleVersioning.js.map