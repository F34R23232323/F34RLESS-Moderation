"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CooldownManager = void 0;
class CooldownManager {
    store = new Map();
    ttlMs;
    constructor(ttlMs = 86_400_000) {
        this.ttlMs = ttlMs;
    }
    key(scope, id, bucket) {
        return `${scope}:${id}:${bucket}`;
    }
    tryConsume(scope, id, bucket, seconds) {
        if (seconds <= 0)
            return true;
        const k = this.key(scope, id, bucket);
        const now = Date.now();
        const expires = this.store.get(k) ?? 0;
        if (expires > now)
            return false;
        this.store.set(k, now + seconds * 1000);
        this.prune(now);
        return true;
    }
    remainingSeconds(scope, id, bucket) {
        const k = this.key(scope, id, bucket);
        const expires = this.store.get(k) ?? 0;
        return Math.max(0, Math.ceil((expires - Date.now()) / 1000));
    }
    clear(scope, id, bucket) {
        this.store.delete(this.key(scope, id, bucket));
    }
    size() {
        return this.store.size;
    }
    prune(now) {
        if (this.store.size < 5000)
            return;
        for (const [k, exp] of this.store) {
            if (exp <= now)
                this.store.delete(k);
        }
    }
}
exports.CooldownManager = CooldownManager;
//# sourceMappingURL=cooldown.js.map