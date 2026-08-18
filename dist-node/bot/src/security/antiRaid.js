"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AntiRaidService = void 0;
const v2_1 = require("../utils/v2");
class AntiRaidService {
    app;
    active = new Set();
    constructor(app) {
        this.app = app;
    }
    isActive(guildId) {
        return this.active.has(guildId);
    }
    async trigger(guildId) {
        if (this.active.has(guildId))
            return;
        const cfg = this.app.config.anti_raid;
        if (!cfg.enabled)
            return;
        const guild = this.app.client.guilds.cache.get(guildId);
        if (!guild)
            return;
        this.active.add(guildId);
        await this.app.logManager.log({
            event: 'member_join',
            guildId,
            message: 'Anti-raid mode triggered',
            details: { action: cfg.action },
        });
        if (cfg.action === 'lock_joins') {
            await guild.edit({ verificationLevel: 3 }).catch(() => undefined);
        }
        else if (cfg.action === 'timeout_joiners') {
            const members = await guild.members.fetch().catch(() => null);
            if (members) {
                const cutoff = Date.now() - 3600_000;
                for (const member of members.values()) {
                    if (member.joinedTimestamp && member.joinedTimestamp > cutoff && !member.user.bot) {
                        await member.timeout(3600_000, 'Anti-raid').catch(() => undefined);
                    }
                }
            }
        }
        setTimeout(() => {
            this.active.delete(guildId);
            if (cfg.action === 'lock_joins') {
                guild.edit({ verificationLevel: 0 }).catch(() => undefined);
            }
        }, 3600_000).unref?.();
    }
    async announce(guildId, channelId) {
        const guild = this.app.client.guilds.cache.get(guildId);
        const channel = guild?.channels.cache.get(channelId);
        if (!channel || !('send' in channel))
            return;
        await (0, v2_1.v2Send)(channel, 'Anti-raid mode is now active. Joins are being monitored.', { accentColor: '#ED4245' }).catch(() => undefined);
    }
}
exports.AntiRaidService = AntiRaidService;
//# sourceMappingURL=antiRaid.js.map