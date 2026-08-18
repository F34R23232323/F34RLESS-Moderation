"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PunishmentEscalation = void 0;
const index_1 = require("../../../shared/src/index");
class PunishmentEscalation {
    app;
    constructor(app) {
        this.app = app;
    }
    async recordTrigger(guildId, userId, rule) {
        const cfg = this.app.config.escalation;
        if (!cfg.enabled)
            return;
        const now = Date.now();
        const [rows] = await this.app.db.query('SELECT count, window_start FROM escalation_state WHERE guild_id = ? AND user_id = ? AND rule = ?', [guildId, userId, rule]);
        let count = 1;
        let windowStart = new Date(now);
        if (rows.length > 0) {
            const existing = rows[0];
            const elapsed = now - new Date(existing.window_start).getTime();
            if (elapsed <= cfg.window_seconds * 1000) {
                count = existing.count + 1;
                windowStart = existing.window_start;
            }
        }
        await this.app.db.execute(`INSERT INTO escalation_state (guild_id, user_id, rule, count, window_start, last_hit)
       VALUES (?, ?, ?, ?, ?, NOW())
       ON DUPLICATE KEY UPDATE count = VALUES(count), window_start = VALUES(window_start), last_hit = NOW()`, [guildId, userId, rule, count, windowStart]);
        await this.evaluate(guildId, userId, rule, count);
    }
    async evaluate(guildId, userId, rule, count) {
        const cfg = this.app.config.escalation;
        const guild = this.app.client.guilds.cache.get(guildId);
        if (!guild)
            return;
        let action;
        for (const r of cfg.rules) {
            if (r.rule !== '*' && r.rule !== rule)
                continue;
            if (count >= r.count) {
                action = r.action;
                break;
            }
        }
        if (!action) {
            for (const g of cfg.global) {
                if (count >= g.count) {
                    action = g.action;
                    break;
                }
            }
        }
        if (!action)
            return;
        const member = await guild.members.fetch(userId).catch(() => null);
        if (!member)
            return;
        const durationMs = action.duration ? ((0, index_1.parseDuration)(action.duration)?.milliseconds ?? 0) : 0;
        await this.app.punishmentManager.applyFromAction(guild, action.type, member, {
            reason: `Punishment escalation (${count} triggers of ${rule})`,
            moderatorId: this.app.client.user?.id ?? null,
            durationMs: durationMs || undefined,
            silent: true,
        });
        await this.app.db.execute('UPDATE escalation_state SET count = 0 WHERE guild_id = ? AND user_id = ? AND rule = ?', [guildId, userId, rule]);
    }
}
exports.PunishmentEscalation = PunishmentEscalation;
//# sourceMappingURL=punishmentEscalation.js.map