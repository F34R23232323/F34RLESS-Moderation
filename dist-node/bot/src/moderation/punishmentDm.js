"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PunishmentDmManager = void 0;
const index_1 = require("../../../shared/src/index");
const v2_1 = require("../utils/v2");
class PunishmentDmManager {
    app;
    constructor(app) {
        this.app = app;
    }
    async send(type, ctx) {
        const cfg = this.app.config.punishment_dms;
        if (!cfg.enabled)
            return false;
        const typeCfg = cfg.types[type];
        if (!typeCfg || !typeCfg.enabled)
            return false;
        const placeholders = {
            guild: ctx.guild.name,
            reason: ctx.reason ?? 'no reason provided',
            moderator: cfg.hide_moderator ? 'staff' : (ctx.moderator ?? 'staff'),
            duration: ctx.durationMs ? (0, index_1.humanizeDuration)(ctx.durationMs) : 'permanent',
            case_id: ctx.caseId ? String(ctx.caseId) : 'n/a',
            appeal_instructions: 'You may appeal this decision by contacting server staff.',
        };
        const content = (0, index_1.renderPlaceholders)(typeCfg.content, placeholders);
        try {
            const dm = await ctx.user.createDM();
            const payload = (0, v2_1.buildV2Content)(content);
            await dm.send({ ...payload });
            return true;
        }
        catch {
            return false;
        }
    }
}
exports.PunishmentDmManager = PunishmentDmManager;
//# sourceMappingURL=punishmentDm.js.map