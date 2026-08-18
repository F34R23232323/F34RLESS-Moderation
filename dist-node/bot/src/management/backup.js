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
exports.runBackup = runBackup;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
async function runBackup(app) {
    const backupDir = path.resolve(process.cwd(), 'backups');
    fs.mkdirSync(backupDir, { recursive: true });
    const filename = `backup-${new Date().toISOString().replace(/[:.]/g, '-')}.sql`;
    const filePath = path.join(backupDir, filename);
    const { env } = app;
    const host = env.MYSQL_HOST;
    const port = env.MYSQL_PORT;
    const user = env.MYSQL_USER;
    const pass = env.MYSQL_PASSWORD;
    const db = env.MYSQL_DATABASE;
    // NOTE: In Docker the MySQL container runs mysqldump natively (see docker/
    // backup service). This in-bot fallback writes a minimal export of the
    // most important tables when mysqldump is not available.
    try {
        const tables = [
            'cases', 'warnings', 'notes', 'automod_triggers', 'reports', 'logs',
            'automod_logs', 'command_usage', 'config_audit', 'custom_commands',
        ];
        const lines = ['-- f34rless-moderation backup', `-- ${new Date().toISOString()}`];
        for (const table of tables) {
            try {
                const [rows] = await app.db.query(`SELECT * FROM ${table}`);
                const data = rows;
                lines.push(`-- ${table}: ${data.length} rows`);
                for (const row of data) {
                    lines.push(`INSERT INTO ${table} (${Object.keys(row).join(',')}) VALUES (${Object.values(row).map((v) => JSON.stringify(v)).join(',')});`);
                }
            }
            catch {
                lines.push(`-- ${table}: skipped (not present)`);
            }
        }
        fs.writeFileSync(filePath, lines.join('\n'), 'utf8');
        app.logger.info(`Backup written to ${filePath}`);
        const retention = app.config.ops.backup_retention_count;
        const files = fs
            .readdirSync(backupDir)
            .filter((f) => f.startsWith('backup-') && f.endsWith('.sql'))
            .sort()
            .reverse();
        for (const f of files.slice(retention)) {
            fs.unlinkSync(path.join(backupDir, f));
        }
    }
    catch (err) {
        app.logger.error('Backup failed:', err);
    }
}
//# sourceMappingURL=backup.js.map