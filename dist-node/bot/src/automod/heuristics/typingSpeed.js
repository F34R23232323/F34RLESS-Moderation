"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createTypingSpeedModule = createTypingSpeedModule;
const lastMessage = new Map();
function createTypingSpeedModule() {
    return {
        name: 'typing_speed',
        async check(ctx) {
            const cfg = ctx.app.config.automod.heuristics.typing_speed;
            if (!ctx.channel)
                return null;
            if (!ctx.content || ctx.content.length === 0)
                return null;
            const now = Date.now();
            const prev = lastMessage.get(ctx.member.id);
            lastMessage.set(ctx.member.id, { ts: now, length: ctx.content.length });
            if (!prev)
                return null;
            const dtSeconds = (now - prev.ts) / 1000;
            if (dtSeconds <= 0)
                return null;
            if (dtSeconds > cfg.window_seconds)
                return null;
            const charsPerSecond = ctx.content.length / dtSeconds;
            if (charsPerSecond >= cfg.min_characters_per_second) {
                return {
                    module: 'typing_speed',
                    rule: 'typing_speed',
                    reason: `typing speed anomaly (~${Math.round(charsPerSecond)} chars/s)`,
                    content: ctx.content,
                };
            }
            return null;
        },
    };
}
//# sourceMappingURL=typingSpeed.js.map