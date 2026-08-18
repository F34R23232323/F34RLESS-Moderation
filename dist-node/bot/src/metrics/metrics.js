"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Metrics = void 0;
class Metrics {
    app;
    messagesProcessed = 0;
    automodTriggers = [];
    commandsExecuted = 0;
    commandsFailed = 0;
    startTime = Date.now();
    window = new Map();
    constructor(app) {
        this.app = app;
    }
    incMessages() {
        this.messagesProcessed++;
        this.push('messages', Date.now());
    }
    incAutomodTrigger() {
        this.automodTriggers.push(Date.now());
    }
    incCommand(success) {
        this.commandsExecuted++;
        if (!success)
            this.commandsFailed++;
    }
    snapshot() {
        const now = Date.now();
        const prune = (arr, windowMs) => arr.filter((t) => now - t <= windowMs).length;
        const recentMsgs = this.window.get('messages') ?? [];
        const last60s = prune(recentMsgs, 60_000);
        const hourMsgs = prune(recentMsgs, 3_600_000);
        return {
            messagesProcessed: this.messagesProcessed,
            messagesPerSecond: Math.round(last60s / 60),
            automodTriggersLastHour: prune(this.automodTriggers, 3_600_000),
            commandsExecuted: this.commandsExecuted,
            commandsFailed: this.commandsFailed,
            activeCooldowns: this.app.cooldowns.size(),
            uptimeSeconds: Math.round((now - this.startTime) / 1000),
            memoryMB: Math.round(process.memoryUsage().rss / 1024 / 1024),
        };
    }
    hourlyVolume() {
        return this.automodTriggers.filter((t) => Date.now() - t <= 3_600_000).length;
    }
    push(key, ts) {
        const arr = this.window.get(key) ?? [];
        arr.push(ts);
        if (arr.length > 10000)
            arr.splice(0, arr.length - 10000);
        this.window.set(key, arr);
    }
}
exports.Metrics = Metrics;
//# sourceMappingURL=metrics.js.map