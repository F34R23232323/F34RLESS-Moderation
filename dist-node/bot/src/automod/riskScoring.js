"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RiskScoring = void 0;
class RiskScoring {
    app;
    cache = new Map();
    constructor(app) {
        this.app = app;
    }
    async add(userId, amount, guildId) {
        const cfg = this.app.config.automod.risk_scoring;
        const key = `${guildId ?? 'g'}:${userId}`;
        const now = Date.now();
        const entry = this.cache.get(key) ?? { score: 0, updatedAt: now, meta: {} };
        entry.score = this.decayed(entry, now) + amount;
        entry.updatedAt = now;
        this.cache.set(key, entry);
        if (guildId) {
            await this.app.db.execute(`INSERT INTO risk_scores (guild_id, user_id, score) VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE score = VALUES(score)`, [guildId, userId, entry.score]);
        }
        if (cfg.enabled && entry.score >= cfg.threshold) {
            await this.triggerThreshold(userId, guildId);
        }
        return entry.score;
    }
    get(userId, guildId) {
        const key = `${guildId ?? 'g'}:${userId}`;
        const entry = this.cache.get(key);
        if (!entry)
            return 0;
        return this.decayed(entry, Date.now());
    }
    decayed(entry, now) {
        const cfg = this.app.config.automod.risk_scoring;
        const elapsed = now - entry.updatedAt;
        if (elapsed <= 0)
            return entry.score;
        const factor = Math.exp(-elapsed / (cfg.decay_seconds * 1000));
        return entry.score * factor;
    }
    async triggerThreshold(userId, guildId) {
        const guild = this.app.client.guilds.cache.get(guildId ?? '');
        if (!guild)
            return;
        const member = await guild.members.fetch(userId).catch(() => null);
        if (!member)
            return;
        await this.app.logManager.log({
            event: 'automod_trigger',
            guildId: guild.id,
            targetId: userId,
            message: `User <@${userId}> crossed composite risk threshold`,
            details: { module: 'risk_scoring', rule: 'risk-threshold' },
        });
    }
}
exports.RiskScoring = RiskScoring;
//# sourceMappingURL=riskScoring.js.map