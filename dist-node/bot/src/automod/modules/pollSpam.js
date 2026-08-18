"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createPollSpamModule = createPollSpamModule;
const tracker_1 = require("../tracker");
const tracker = new tracker_1.MessageTracker();
function createPollSpamModule() {
    return {
        name: 'poll_spam',
        async check(ctx) {
            const cfg = ctx.app.config.automod.modules.poll_spam;
            if (!ctx.channel)
                return null;
            const hasPoll = Boolean(ctx.message.poll);
            if (!hasPoll)
                return null;
            const key = `poll:${ctx.member.id}`;
            tracker.push(key);
            if (tracker.countInWindow(key, cfg.window_seconds * 1000) >= cfg.threshold) {
                return {
                    module: 'poll_spam',
                    rule: 'poll_spam',
                    reason: `too many polls in ${cfg.window_seconds}s`,
                    content: ctx.content,
                };
            }
            return null;
        },
    };
}
//# sourceMappingURL=pollSpam.js.map