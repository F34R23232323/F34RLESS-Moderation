"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SlowmodeScheduler = void 0;
const tracker_1 = require("../automod/tracker");
class SlowmodeScheduler {
    app;
    tracker = new tracker_1.MessageTracker();
    reverted = new Map();
    constructor(app) {
        this.app = app;
    }
    onMessage(channelId) {
        if (!this.app.config.slowmode_scheduler.enabled)
            return;
        this.tracker.push(`slow:${channelId}`);
        const cfg = this.app.config.slowmode_scheduler;
        const count = this.tracker.countInWindow(`slow:${channelId}`, 60_000);
        if (count >= cfg.threshold_messages_per_minute) {
            void this.applySlowmode(channelId, cfg.slowmode_seconds);
        }
    }
    async applySlowmode(channelId, slowmodeSeconds) {
        const channel = this.app.client.channels.cache.get(channelId);
        if (!channel || channel.rateLimitPerUser >= slowmodeSeconds)
            return;
        await channel.setRateLimitPerUser(slowmodeSeconds, 'Auto slowmode').catch(() => undefined);
        const existing = this.reverted.get(channelId);
        if (existing)
            clearTimeout(existing);
        const cfg = this.app.config.slowmode_scheduler;
        const timer = setTimeout(() => {
            void this.revert(channelId);
        }, cfg.revert_after_minutes * 60_000);
        timer.unref?.();
        this.reverted.set(channelId, timer);
    }
    async revert(channelId) {
        this.reverted.delete(channelId);
        const channel = this.app.client.channels.cache.get(channelId);
        if (!channel)
            return;
        await channel.setRateLimitPerUser(0, 'Auto slowmode revert').catch(() => undefined);
    }
    revertLoop() {
        setInterval(() => {
            const now = Date.now();
            for (const [id, entry] of this.entries()) {
                void entry;
                this.tracker.countInWindow(`slow:${id}`, 60_000, now);
            }
        }, 60_000).unref?.();
    }
    *entries() {
        for (const [key] of this.reverted) {
            yield [key, 0];
        }
    }
}
exports.SlowmodeScheduler = SlowmodeScheduler;
//# sourceMappingURL=slowmodeScheduler.js.map