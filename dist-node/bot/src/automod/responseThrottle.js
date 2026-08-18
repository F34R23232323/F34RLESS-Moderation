"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ResponseThrottle = void 0;
class ResponseThrottle {
    entries = new Map();
    shouldSuppress(rule, channelId, userId, suppressSeconds, mode) {
        if (suppressSeconds <= 0)
            return { suppressSend: false, shouldSummarize: false };
        const key = `${rule}:${channelId}`;
        const now = Date.now();
        const entry = this.entries.get(key);
        if (!entry || now - entry.lastSentAt >= suppressSeconds * 1000) {
            const next = { lastSentAt: now, suppressedCount: 0, userCount: new Set(), timer: null };
            if (mode === 'batched_summary') {
                next.timer = setTimeout(() => {
                    this.flush(rule, channelId);
                }, suppressSeconds * 1000);
                next.timer.unref?.();
            }
            this.entries.set(key, next);
            return { suppressSend: false, shouldSummarize: false };
        }
        entry.suppressedCount += 1;
        entry.userCount.add(userId);
        return { suppressSend: true, shouldSummarize: mode === 'batched_summary' };
    }
    consumeSummary(rule, channelId) {
        const entry = this.entries.get(`${rule}:${channelId}`);
        if (!entry || entry.suppressedCount === 0)
            return null;
        const result = { count: entry.suppressedCount, users: entry.userCount.size };
        entry.suppressedCount = 0;
        entry.userCount.clear();
        return result;
    }
    flush(rule, channelId) {
        const entry = this.entries.get(`${rule}:${channelId}`);
        if (entry)
            entry.timer = null;
    }
}
exports.ResponseThrottle = ResponseThrottle;
//# sourceMappingURL=responseThrottle.js.map