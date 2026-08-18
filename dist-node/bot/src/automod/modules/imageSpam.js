"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createImageSpamModule = createImageSpamModule;
const tracker_1 = require("../tracker");
const tracker = new tracker_1.MessageTracker();
function createImageSpamModule() {
    return {
        name: 'image_spam',
        async check(ctx) {
            const cfg = ctx.app.config.automod.modules.image_spam;
            if (!ctx.message || !ctx.channel)
                return null;
            const hasImage = ctx.message.attachments.some((a) => a.contentType?.startsWith('image/'));
            if (!hasImage)
                return null;
            const key = `img:${ctx.member.id}:${ctx.channel.id}`;
            tracker.push(key);
            if (tracker.countInWindow(key, cfg.window_seconds * 1000) >= cfg.threshold) {
                return { module: 'image_spam', rule: 'image_spam', reason: 'too many images in window', content: ctx.content };
            }
            return null;
        },
    };
}
//# sourceMappingURL=imageSpam.js.map