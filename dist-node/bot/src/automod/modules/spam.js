"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createSpamModule = createSpamModule;
function createSpamModule(tracker) {
    return {
        name: 'spam',
        async check(ctx) {
            const cfg = ctx.app.config.automod.modules.spam;
            if (!ctx.channel)
                return null;
            const key = `spam:${ctx.member.id}:${ctx.channel.id}`;
            tracker.push(key);
            const count = tracker.countInWindow(key, cfg.window_seconds * 1000);
            if (count >= cfg.threshold) {
                return {
                    module: 'spam',
                    rule: 'spam',
                    reason: `${count} messages in ${cfg.window_seconds}s`,
                    content: ctx.content,
                };
            }
            return null;
        },
    };
}
//# sourceMappingURL=spam.js.map