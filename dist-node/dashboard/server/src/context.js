"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadDashboardContext = loadDashboardContext;
const index_1 = require("../../../shared/src/index");
function loadDashboardContext() {
    let config;
    try {
        config = (0, index_1.loadConfig)();
    }
    catch (err) {
        console.error((0, index_1.formatConfigError)(err));
        process.exit(1);
    }
    const { env } = config;
    const ownerUserId = env.OWNER_USER_ID || config.config.dashboard.owner_user_id || '';
    if (!ownerUserId) {
        console.error('Dashboard owner_user_id is not configured (set OWNER_USER_ID in .env or config.yml).');
        process.exit(1);
    }
    const db = (0, index_1.createDbPool)((0, index_1.buildDatabaseUrl)(env));
    return {
        db,
        ownerUserId,
        sessionSecret: env.DASHBOARD_SESSION_SECRET,
        clientId: env.CLIENT_ID,
        clientSecret: env.CLIENT_SECRET,
        baseUrl: env.DASHBOARD_BASE_URL || 'http://localhost:3000',
        port: config.config.dashboard.port,
    };
}
//# sourceMappingURL=context.js.map