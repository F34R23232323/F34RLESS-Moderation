"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const express_1 = __importDefault(require("express"));
const http_1 = require("http");
const context_1 = require("./context");
const oauth_1 = require("./oauth");
const auth_1 = require("./auth");
const logs_1 = require("./routes/logs");
const cases_1 = require("./routes/cases");
const config_1 = require("./routes/config");
const misc_1 = require("./routes/misc");
const ws_1 = require("./ws");
const index_1 = require("../../../shared/src/index");
function cookieMiddleware(req, _res, next) {
    const header = req.headers.cookie;
    const cookies = {};
    if (header) {
        for (const part of header.split(';')) {
            const idx = part.indexOf('=');
            if (idx > -1) {
                const key = part.slice(0, idx).trim();
                const value = part.slice(idx + 1).trim();
                cookies[key] = decodeURIComponent(value);
            }
        }
    }
    req.cookies = cookies;
    next();
}
async function main() {
    const ctx = (0, context_1.loadDashboardContext)();
    try {
        await (0, index_1.waitForDb)(ctx.db, 90_000);
    }
    catch (err) {
        console.error('Database not reachable:', err);
        process.exit(1);
    }
    try {
        await (0, index_1.runMigrations)(ctx.db, index_1.migrations);
    }
    catch (err) {
        console.error('Migration failed:', err);
        process.exit(1);
    }
    const app = (0, express_1.default)();
    app.use(express_1.default.json({ limit: '2mb' }));
    app.use(cookieMiddleware);
    app.get('/api/health', (_req, res) => res.json({ ok: true }));
    app.use('/oauth', (0, oauth_1.createAuthRouter)(ctx));
    const protectedApi = express_1.default.Router();
    protectedApi.use((0, auth_1.requireAuth)(ctx));
    protectedApi.use('/logs', (0, logs_1.createApiRouter)(ctx));
    protectedApi.use('/cases', (0, cases_1.createCasesRouter)(ctx));
    protectedApi.use('/config', (0, config_1.createConfigRouter)(ctx));
    protectedApi.use('/', (0, misc_1.createMiscRouter)(ctx));
    app.use('/api', protectedApi);
    const webDist = path.resolve(__dirname, '../../web/dist');
    if (fs.existsSync(webDist)) {
        app.use(express_1.default.static(webDist));
        app.get(/^\/(?!api|oauth|ws).*/, (_req, res) => {
            res.sendFile(path.join(webDist, 'index.html'));
        });
    }
    else {
        app.get('/', (_req, res) => res.send('Dashboard frontend not built. Run `npm run dev:web` for development.'));
    }
    const server = (0, http_1.createServer)(app);
    (0, ws_1.createWebSocketServer)(server, ctx.db, ctx.sessionSecret);
    server.listen(ctx.port, () => {
        console.log(`Dashboard listening on http://localhost:${ctx.port}`);
    });
}
main().catch((err) => {
    console.error('Dashboard failed to start:', err);
    process.exit(1);
});
//# sourceMappingURL=index.js.map