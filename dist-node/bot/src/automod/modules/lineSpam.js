"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createLineSpamModule = createLineSpamModule;
const tracker_1 = require("../tracker");
const tracker = new tracker_1.MessageTracker();
const lineTracker = new tracker_1.MessageTracker();
function createLineSpamModule() {
    return {
        name: 'line_spam',
        async check(ctx) {
            const cfg = ctx.app.config.automod.modules.line_spam;
            if (!ctx.content)
                return null;
            const lines = ctx.content.split('\n').length;
            if (lines >= cfg.per_message_lines) {
                return { module: 'line_spam', rule: 'line_spam', reason: `${lines} lines in one message`, content: ctx.content };
            }
            const key = `lines:${ctx.member.id}`;
            const windowMs = cfg.multi_message_window_seconds * 1000;
            for (let i = 0; i < lines; i++)
                tracker.push(key);
            const total = tracker.countInWindow(key, windowMs);
            if (total >= cfg.multi_message_lines) {
                lineTracker.push(`linehit:${ctx.member.id}`);
                return {
                    module: 'line_spam',
                    rule: 'line_spam_multi',
                    reason: `${total} lines across messages in ${cfg.multi_message_window_seconds}s`,
                    content: ctx.content,
                };
            }
            return null;
        },
    };
}
//# sourceMappingURL=lineSpam.js.map