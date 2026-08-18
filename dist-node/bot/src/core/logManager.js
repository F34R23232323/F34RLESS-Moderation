"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LogManager = void 0;
const events_1 = require("events");
const v2_1 = require("../utils/v2");
class LogManager extends events_1.EventEmitter {
    db;
    app = null;
    constructor(db) {
        super();
        this.db = db;
    }
    async log(input) {
        try {
            const [result] = await this.db.execute(`INSERT INTO logs (event, guild_id, channel_id, actor_id, target_id, message, details)
         VALUES (?, ?, ?, ?, ?, ?, ?)`, [
                input.event,
                input.guildId,
                input.channelId ?? null,
                input.actorId ?? null,
                input.targetId ?? null,
                input.message ?? null,
                input.details ? JSON.stringify(input.details) : null,
            ]);
            this.emit('log', { ...input });
            const insertId = result.insertId;
            await this.routeToDiscord(input);
            return insertId;
        }
        catch (err) {
            console.error('LogManager.log failed:', err);
            return null;
        }
    }
    async routeToDiscord(input) {
        const app = this.app;
        if (!app)
            return;
        const cfg = app.config.logging[input.event];
        if (!cfg || !cfg.enabled)
            return;
        const guild = app.client.guilds.cache.get(input.guildId);
        if (!guild)
            return;
        const channel = (cfg.thread_id && guild.channels.cache.get(cfg.thread_id)) ||
            (cfg.channel_id && guild.channels.cache.get(cfg.channel_id));
        if (!channel || !('send' in channel))
            return;
        const lines = [input.message ?? input.event];
        if (input.details && typeof input.details === 'object') {
            try {
                lines.push('```json\n' + JSON.stringify(input.details, null, 2).slice(0, 1500) + '\n```');
            }
            catch {
                /* ignore */
            }
        }
        try {
            await (0, v2_1.v2Send)(channel, lines.join('\n'), { accentColor: '#5865F2' });
        }
        catch (err) {
            console.error(`Failed to route log ${input.event} to channel:`, err);
        }
    }
    async logAutomodTrigger(entry) {
        try {
            await this.db.execute(`INSERT INTO automod_logs (guild_id, rule, module, user_id, channel_id, message_id, content_snippet, stored_content, actions_taken, actions_failed, response_suppressed, case_ids)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
                entry.guildId,
                entry.rule,
                entry.module,
                entry.userId,
                entry.channelId ?? null,
                entry.messageId ?? null,
                entry.contentSnippet ?? null,
                entry.storedContent ?? null,
                JSON.stringify(entry.actionsTaken),
                JSON.stringify(entry.actionsFailed),
                entry.responseSuppressed ? 1 : 0,
                JSON.stringify(entry.caseIds),
            ]);
            this.emit('automod_log', entry);
            await this.routeAutomodLogToDiscord(entry);
        }
        catch (err) {
            console.error('logAutomodTrigger failed:', err);
        }
    }
    async routeAutomodLogToDiscord(entry) {
        const app = this.app;
        if (!app)
            return;
        const guild = app.client.guilds.cache.get(entry.guildId);
        if (!guild)
            return;
        const moduleCfg = app.config.automod.modules[entry.module];
        const targetId = moduleCfg?.log_channel_id || app.config.automod.log_channel_id;
        const threadId = moduleCfg?.log_thread_id || app.config.automod.log_thread_id;
        const channel = (threadId && guild.channels.cache.get(threadId)) || (targetId && guild.channels.cache.get(targetId));
        if (!channel || !('send' in channel))
            return;
        const suppressed = entry.responseSuppressed ? ' (response throttled)' : '';
        const snippet = entry.contentSnippet ? `\nMatched: ${entry.contentSnippet.slice(0, 300)}` : '';
        await (0, v2_1.v2Send)(channel, `[Automod] ${entry.module} — ${entry.rule} — <@${entry.userId}>${suppressed}${snippet}`, {
            accentColor: '#ED4245',
        }).catch(() => undefined);
    }
    async logCommandUsage(entry) {
        try {
            await this.db.execute(`INSERT INTO command_usage (guild_id, command, user_id, surface, success, duration_ms, error)
         VALUES (?, ?, ?, ?, ?, ?, ?)`, [entry.guildId, entry.command, entry.userId, entry.surface, entry.success ? 1 : 0, entry.durationMs ?? null, entry.error ?? null]);
        }
        catch (err) {
            console.error('logCommandUsage failed:', err);
        }
    }
    async reportError(source, err) {
        const app = this.app;
        const message = err instanceof Error ? `${err.name}: ${err.message}\n${err.stack ?? ''}` : String(err);
        const cleaned = message.slice(0, 3000);
        await this.log({
            event: 'error_event',
            guildId: app?.config.bot.owner_ids[0] ?? '0',
            message: `[${source}] ${cleaned}`,
            details: { source, stack: message },
        }).catch(() => undefined);
        if (!app)
            return;
        const cfg = app.config.error_reporting;
        if (!cfg.enabled)
            return;
        if (cfg.channel_id) {
            const channel = app.client.channels.cache.get(cfg.channel_id);
            if (channel && 'send' in channel) {
                const verbosity = cfg.verbosity === 'verbose' ? cleaned : err instanceof Error ? err.message : cleaned.slice(0, 500);
                await (0, v2_1.v2Send)(channel, `[Error] ${source}\n${verbosity.slice(0, 1800)}`, { accentColor: '#ED4245' }).catch(() => undefined);
            }
        }
        if (cfg.webhook_url) {
            await this.postWebhook(cfg.webhook_url, { content: `[Error] ${source}\n${cleaned.slice(0, 1900)}` }).catch(() => undefined);
        }
    }
    async reportRateLimit(data) {
        const app = this.app;
        await this.log({
            event: 'rate_limit_event',
            guildId: app?.config.bot.owner_ids[0] ?? '0',
            message: `Rate limited on ${data.method} ${data.route}${data.global ? ' (GLOBAL)' : ''} for ${data.timeout}ms`,
            details: data,
        }).catch(() => undefined);
        if (!app)
            return;
        const cfg = app.config.rate_limit_reporting;
        if (!cfg.enabled)
            return;
        const text = `Rate limited\nMethod: ${data.method}\nRoute: ${data.route}\nTimeout: ${data.timeout}ms\nGlobal: ${data.global}`;
        if (cfg.channel_id) {
            const channel = app.client.channels.cache.get(cfg.channel_id);
            if (channel && 'send' in channel) {
                await (0, v2_1.v2Send)(channel, text, { accentColor: '#FEE75C' }).catch(() => undefined);
            }
        }
        if (cfg.webhook_url) {
            await this.postWebhook(cfg.webhook_url, { content: text }).catch(() => undefined);
        }
    }
    async postWebhook(url, payload) {
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
        if (!res.ok)
            throw new Error(`Webhook returned ${res.status}`);
    }
}
exports.LogManager = LogManager;
//# sourceMappingURL=logManager.js.map