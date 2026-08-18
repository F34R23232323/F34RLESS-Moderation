"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createEmojiSpamModule = createEmojiSpamModule;
const EMOJI_RE = /<a?:\w+:\d{15,20}>/g;
function createEmojiSpamModule() {
    return {
        name: 'emoji_spam',
        async check(ctx) {
            const cfg = ctx.app.config.automod.modules.emoji_spam;
            if (!ctx.content)
                return null;
            const matches = ctx.content.match(EMOJI_RE);
            if (!matches)
                return null;
            if (matches.length >= cfg.threshold) {
                return {
                    module: 'emoji_spam',
                    rule: 'emoji_spam',
                    reason: `${matches.length} emojis in one message`,
                    content: ctx.content,
                };
            }
            return null;
        },
    };
}
//# sourceMappingURL=emojiSpam.js.map