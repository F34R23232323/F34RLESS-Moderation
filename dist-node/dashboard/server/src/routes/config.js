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
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConfigValidationError = void 0;
exports.createConfigRouter = createConfigRouter;
const express_1 = require("express");
const fs = __importStar(require("fs"));
const YAML = __importStar(require("yaml"));
const index_1 = require("../../../../shared/src/index");
Object.defineProperty(exports, "ConfigValidationError", { enumerable: true, get: function () { return index_1.ConfigValidationError; } });
function createConfigRouter(ctx) {
    const router = (0, express_1.Router)();
    router.get('/', (_req, res) => {
        const configPath = process.env.CONFIG_PATH ? process.env.CONFIG_PATH : process.cwd() + '/config.yml';
        let content = '';
        if (fs.existsSync(configPath)) {
            content = fs.readFileSync(configPath, 'utf8');
        }
        res.json({ configPath, yaml: content });
    });
    router.post('/validate', (req, res) => {
        const yaml = req.body.yaml;
        if (!yaml) {
            res.status(400).json({ ok: false, error: 'no yaml provided' });
            return;
        }
        try {
            const parsed = YAML.parse(yaml);
            const result = index_1.configSchema.safeParse(parsed ?? {});
            const issues = [];
            if (!result.success) {
                for (const issue of result.error.issues) {
                    issues.push({ path: issue.path.join('.'), message: issue.message });
                }
            }
            else {
                for (const issue of (0, index_1.runCrossFieldChecks)(result.data)) {
                    issues.push(issue);
                }
            }
            res.json({ ok: issues.length === 0, issues });
        }
        catch (err) {
            res.json({ ok: false, issues: [{ path: '(parse)', message: err.message }] });
        }
    });
    router.post('/save', (req, res) => {
        const body = req.body;
        if (!body.yaml) {
            res.status(400).json({ ok: false, error: 'no yaml provided' });
            return;
        }
        try {
            const parsed = YAML.parse(body.yaml);
            const result = index_1.configSchema.safeParse(parsed ?? {});
            if (!result.success || (0, index_1.runCrossFieldChecks)(result.success ? result.data : {}).length > 0) {
                res.status(400).json({ ok: false, error: 'config failed validation' });
                return;
            }
        }
        catch {
            res.status(400).json({ ok: false, error: 'config failed validation' });
            return;
        }
        const configPath = process.env.CONFIG_PATH ? process.env.CONFIG_PATH : process.cwd() + '/config.yml';
        const oldContent = fs.existsSync(configPath) ? fs.readFileSync(configPath, 'utf8') : '';
        fs.writeFileSync(configPath, body.yaml, 'utf8');
        void ctx.db.execute('INSERT INTO config_audit (guild_id, actor_id, path, old_value, new_value, source) VALUES (?, ?, ?, ?, ?, ?)', ['0', body.actorId ?? null, configPath, JSON.stringify(oldContent), JSON.stringify(body.yaml), 'dashboard']);
        res.json({ ok: true });
    });
    router.get('/default', (_req, res) => {
        res.json({ yaml: index_1.DEFAULT_CONFIG_YAML });
    });
    router.post('/reload', (_req, res) => {
        try {
            (0, index_1.loadConfig)();
            res.json({ ok: true });
        }
        catch (err) {
            res.json({ ok: false, error: (0, index_1.formatConfigError)(err) });
        }
    });
    router.get('/audit', async (_req, res) => {
        const [rows] = await ctx.db.query('SELECT id, actor_id, path, source, created_at FROM config_audit ORDER BY id DESC LIMIT 100');
        res.json({ rows });
    });
    return router;
}
//# sourceMappingURL=config.js.map