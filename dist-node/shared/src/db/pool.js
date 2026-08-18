"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createDbPool = createDbPool;
exports.ping = ping;
exports.waitForDb = waitForDb;
const promise_1 = require("mysql2/promise");
function createDbPool(connectionString, extra = {}) {
    return (0, promise_1.createPool)({
        uri: connectionString,
        connectionLimit: 10,
        charset: 'utf8mb4',
        dateStrings: false,
        ...extra,
    });
}
async function ping(pool) {
    try {
        await pool.query('SELECT 1');
        return true;
    }
    catch {
        return false;
    }
}
async function waitForDb(pool, timeoutMs = 60_000) {
    const deadline = Date.now() + timeoutMs;
    let lastError;
    while (Date.now() < deadline) {
        if (await ping(pool))
            return;
        await new Promise((resolve) => setTimeout(resolve, 2000));
    }
    throw new Error(`Database not reachable within ${timeoutMs}ms: ${lastError?.message ?? 'unknown error'}`);
}
//# sourceMappingURL=pool.js.map