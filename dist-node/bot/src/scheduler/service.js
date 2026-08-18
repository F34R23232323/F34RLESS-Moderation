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
exports.SchedulerService = void 0;
const cron = __importStar(require("node-cron"));
class SchedulerService {
    app;
    jobs = [];
    timers = new Map();
    constructor(app) {
        this.app = app;
    }
    start() {
        this.schedulePunishmentExpiry();
        this.scheduleReminders();
        this.scheduleLockdowns();
        this.scheduleAnnouncements();
        this.scheduleBackups();
        this.scheduleSlowmodeRevert();
        this.scheduleBirthdays();
        this.scheduleTrustLevels();
        this.app.logger.info('Scheduler started');
    }
    addCron(id, expression, run) {
        if (!cron.validate(expression)) {
            this.app.logger.warn(`Invalid cron expression for job ${id}: ${expression}`);
            return;
        }
        this.jobs.push({ id, cron: expression, run });
        cron.schedule(expression, () => {
            void Promise.resolve(run()).catch((err) => this.app.logManager.reportError(`cron job ${id}`, err));
        });
    }
    setTimeout(id, delayMs, run) {
        this.clearTimeout(id);
        const timer = setTimeout(() => {
            this.timers.delete(id);
            void Promise.resolve(run()).catch((err) => this.app.logManager.reportError(`timer job ${id}`, err));
        }, delayMs);
        timer.unref?.();
        this.timers.set(id, timer);
    }
    clearTimeout(id) {
        const existing = this.timers.get(id);
        if (existing) {
            clearTimeout(existing);
            this.timers.delete(id);
        }
    }
    schedulePunishmentExpiry() {
        this.addCron('punishment-expiry', '*/30 * * * * *', async () => {
            const [rows] = await this.app.db.query('SELECT id, guild_id, user_id, type, role_id, case_id FROM punishments WHERE active = 1 AND expires_at <= NOW()');
            for (const row of rows) {
                const guild = this.app.client.guilds.cache.get(row.guild_id);
                if (!guild)
                    continue;
                try {
                    if (row.type === 'mute') {
                        const member = await guild.members.fetch(row.user_id).catch(() => null);
                        if (member)
                            await member.timeout(null);
                    }
                    else if (row.type === 'ban') {
                        await guild.bans.remove(row.user_id, 'temp ban expired');
                    }
                    else if (row.type === 'temp_role' && row.role_id) {
                        const member = await guild.members.fetch(row.user_id).catch(() => null);
                        if (member)
                            await member.roles.remove(row.role_id, 'temp role expired');
                    }
                    await this.app.db.execute('UPDATE punishments SET active = 0 WHERE id = ?', [row.id]);
                }
                catch (err) {
                    this.app.logger.warn(`Failed to expire punishment ${row.id}:`, err);
                }
            }
        });
    }
    scheduleReminders() {
        this.addCron('reminders', '*/15 * * * * *', async () => {
            const [rows] = await this.app.db.query("SELECT id, user_id, channel_id, message FROM reminders WHERE status = 'pending' AND remind_at <= NOW()");
            for (const row of rows) {
                try {
                    if (row.channel_id) {
                        const channel = this.app.client.channels.cache.get(row.channel_id);
                        if (channel && 'send' in channel) {
                            await channel.send({ content: `<@${row.user_id}> reminder: ${row.message}` });
                        }
                    }
                    else {
                        const user = await this.app.client.users.fetch(row.user_id).catch(() => null);
                        if (user)
                            await user.send({ content: `Reminder: ${row.message}` });
                    }
                    await this.app.db.execute("UPDATE reminders SET status = 'done' WHERE id = ?", [row.id]);
                }
                catch {
                    await this.app.db.execute("UPDATE reminders SET status = 'failed' WHERE id = ?", [row.id]);
                }
            }
        });
    }
    scheduleLockdowns() {
        for (const preset of this.app.config.channel_locking.presets) {
            for (const sched of preset.schedule) {
                this.addCron(`lockdown-${preset.name}-${sched.action}`, sched.cron, async () => {
                    const channelLocking = this.app.lockingService;
                    if (sched.action === 'lock')
                        await channelLocking.lock(preset.name);
                    else
                        await channelLocking.unlock(preset.name);
                });
            }
        }
    }
    scheduleAnnouncements() {
        this.addCron('announcements', '*/30 * * * * *', async () => {
            const [rows] = await this.app.db.query('SELECT id, guild_id, channel_id, content, cron FROM scheduled_announcements WHERE enabled = 1 AND next_run IS NOT NULL AND next_run <= NOW()');
            for (const row of rows) {
                try {
                    const channel = this.app.client.channels.cache.get(row.channel_id);
                    if (channel && 'send' in channel) {
                        const content = JSON.parse(row.content);
                        await channel.send({ content: content.content ?? '', ...(content.components ? { components: content.components } : {}) });
                    }
                    if (cron.validate(row.cron)) {
                        const next = cron.schedule(row.cron, () => undefined);
                        const nextRun = next.nextRun();
                        await this.app.db.execute('UPDATE scheduled_announcements SET next_run = ? WHERE id = ?', [nextRun, row.id]);
                    }
                    else {
                        await this.app.db.execute('UPDATE scheduled_announcements SET enabled = 0 WHERE id = ?', [row.id]);
                    }
                }
                catch (err) {
                    this.app.logger.warn(`Scheduled announcement ${row.id} failed:`, err);
                }
            }
        });
    }
    scheduleBackups() {
        if (!this.app.config.ops.backups_enabled)
            return;
        this.addCron('backup', '0 3 * * *', async () => {
            const backup = await Promise.resolve().then(() => __importStar(require('../management/backup')));
            await backup.runBackup(this.app);
        });
    }
    scheduleSlowmodeRevert() {
        const ssm = this.app.slowmodeScheduler;
        ssm.revertLoop();
    }
    scheduleBirthdays() {
        if (!this.app.config.community.birthdays.enabled)
            return;
        this.addCron('birthdays', '0 9 * * *', async () => {
            const bday = await Promise.resolve().then(() => __importStar(require('../community/birthdays')));
            await bday.announceBirthdays(this.app);
        });
    }
    scheduleTrustLevels() {
        if (!this.app.config.trust_levels.enabled)
            return;
        this.addCron('trust-levels', '*/10 * * * * *', async () => {
            const trust = await Promise.resolve().then(() => __importStar(require('../management/trustLevels')));
            await trust.checkAll(this.app);
        });
    }
}
exports.SchedulerService = SchedulerService;
//# sourceMappingURL=service.js.map