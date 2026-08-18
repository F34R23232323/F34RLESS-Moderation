"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MessageTracker = void 0;
class MessageTracker {
    store = new Map();
    limit = 200;
    push(key, timestamp = Date.now()) {
        const arr = this.store.get(key) ?? [];
        arr.push(timestamp);
        const cutoff = timestamp - 3600_000;
        const filtered = arr.filter((t) => t >= cutoff);
        if (filtered.length > this.limit)
            filtered.splice(0, filtered.length - this.limit);
        this.store.set(key, filtered);
        return filtered.length;
    }
    countInWindow(key, windowMs, now = Date.now()) {
        const arr = this.store.get(key) ?? [];
        const cutoff = now - windowMs;
        return arr.filter((t) => t >= cutoff).length;
    }
    timestampsInWindow(key, windowMs, now = Date.now()) {
        const arr = this.store.get(key) ?? [];
        const cutoff = now - windowMs;
        return arr.filter((t) => t >= cutoff);
    }
    clear(key) {
        this.store.delete(key);
    }
}
exports.MessageTracker = MessageTracker;
//# sourceMappingURL=tracker.js.map