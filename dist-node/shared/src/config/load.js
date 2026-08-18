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
exports.loadEnv = loadEnv;
exports.buildDatabaseUrl = buildDatabaseUrl;
exports.loadConfig = loadConfig;
exports.formatConfigError = formatConfigError;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const dotenv = __importStar(require("dotenv"));
const YAML = __importStar(require("yaml"));
const schema_1 = require("./schema");
const crossField_1 = require("./crossField");
const errors_1 = require("./errors");
function requireEnv(name) {
    const v = process.env[name];
    if (!v || v.trim().length === 0) {
        throw new Error(`Missing required environment variable: ${name}`);
    }
    return v;
}
function loadEnv() {
    dotenv.config();
    return {
        DISCORD_TOKEN: process.env.DISCORD_TOKEN || '',
        OWNER_USER_ID: process.env.OWNER_USER_ID,
        DASHBOARD_SESSION_SECRET: requireEnv('DASHBOARD_SESSION_SECRET'),
        MYSQL_HOST: process.env.MYSQL_HOST || 'localhost',
        MYSQL_PORT: process.env.MYSQL_PORT || '3390',
        MYSQL_DATABASE: requireEnv('MYSQL_DATABASE'),
        MYSQL_USER: requireEnv('MYSQL_USER'),
        MYSQL_PASSWORD: process.env.MYSQL_PASSWORD || '',
        DATABASE_URL: process.env.DATABASE_URL,
        CONFIG_PATH: process.env.CONFIG_PATH,
        CLIENT_ID: requireEnv('CLIENT_ID'),
        CLIENT_SECRET: requireEnv('CLIENT_SECRET'),
        DASHBOARD_BASE_URL: process.env.DASHBOARD_BASE_URL || 'http://localhost:4693',
        REGISTER_GUILD_ID: process.env.REGISTER_GUILD_ID,
    };
}
function buildDatabaseUrl(env) {
    if (env.DATABASE_URL && env.DATABASE_URL.trim().length > 0)
        return env.DATABASE_URL;
    return `mysql://${encodeURIComponent(env.MYSQL_USER)}:${encodeURIComponent(env.MYSQL_PASSWORD)}@${env.MYSQL_HOST}:${env.MYSQL_PORT}/${env.MYSQL_DATABASE}`;
}
function loadConfig(options) {
    const env = loadEnv();
    const configPath = path.resolve(options?.configPath || env.CONFIG_PATH || process.cwd() + '/config.yml');
    if (!fs.existsSync(configPath)) {
        throw new Error(`Config file not found at ${configPath}. Copy config.yml from the repository root or set CONFIG_PATH.`);
    }
    if (fs.statSync(configPath).isDirectory()) {
        throw new Error(`Expected a config FILE at ${configPath} but found a directory. ` +
            `This usually means config.yml does not exist on the host and Docker created an empty directory at the mount point. ` +
            `Create config.yml first (e.g. \`npm run gen-config\`), then \`docker compose down && docker compose up -d\` to replace the directory mount.`);
    }
    const raw = fs.readFileSync(configPath, 'utf8');
    let parsed;
    try {
        parsed = YAML.parse(raw);
    }
    catch (e) {
        throw new Error(`Failed to parse ${configPath}: ${e.message}`);
    }
    const result = schema_1.configSchema.safeParse(parsed ?? {});
    const issues = [];
    if (!result.success) {
        for (const issue of result.error.issues) {
            issues.push({
                path: issue.path.join('.') || '(root)',
                expected: 'expected ' + String(issue.expected ?? issue.message),
                found: 'received ' + JSON.stringify(issue.received),
            });
        }
    }
    const config = result.success ? result.data : null;
    if (result.success) {
        issues.push(...(0, crossField_1.runCrossFieldChecks)(config));
    }
    if (issues.length > 0) {
        throw new errors_1.ConfigValidationError(issues);
    }
    return { config, env, configPath };
}
function formatConfigError(err) {
    if (err instanceof errors_1.ConfigValidationError)
        return err.formatHumanReadable();
    return err.message;
}
//# sourceMappingURL=load.js.map