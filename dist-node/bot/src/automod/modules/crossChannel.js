"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createCrossChannelModule = createCrossChannelModule;
const store = new Map();
function createCrossChannelModule() {
    return {
        name: 'cross_channel',
        async check(ctx) {
            const cfg = ctx.app.config.automod.modules.cross_channel;
            if (!ctx.channel)
                return null;
            const key = ctx.member.id;
            const now = Date.now();
            const events = (store.get(key) ?? []).filter((e) => now - e.ts <= cfg.window_seconds * 1000);
            events.push({ ts: now, channelId: ctx.channel.id });
            store.set(key, events);
            if (events.length > 200)
                events.splice(0, events.length - 200);
            const distinctChannels = new Set(events.map((e) => e.channelId));
            if (distinctChannels.size >= cfg.threshold) {
                return {
                    module: 'cross_channel',
                    rule: 'cross_channel',
                    reason: `${distinctChannels.size} distinct channels messaged in ${cfg.window_seconds}s`,
                    content: ctx.content,
                };
            }
            return null;
        },
    };
}
//# sourceMappingURL=crossChannel.js.map