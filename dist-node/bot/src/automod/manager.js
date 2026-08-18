"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AutomodManager = void 0;
const chainExecutor_1 = require("./chainExecutor");
const responseThrottle_1 = require("./responseThrottle");
class AutomodManager {
    app;
    executor;
    throttle;
    modules = [];
    joinModules = new Map();
    constructor(app) {
        this.app = app;
        this.throttle = new responseThrottle_1.ResponseThrottle();
        this.executor = new chainExecutor_1.ActionChainExecutor(app, this.throttle);
    }
    registerModule(module) {
        this.modules.push(module);
    }
    registerJoinModule(module) {
        this.joinModules.set(module.name, module);
    }
    async handleMessage(message) {
        if (!this.app.config.automod.enabled)
            return;
        if (message.author.bot)
            return;
        const guild = message.guild;
        const member = message.member;
        const channel = message.channel;
        if (!guild || !member || !('id' in channel))
            return;
        const globalImmune = this.app.config.automod.global_immune_roles;
        if (member.roles.cache.some((r) => globalImmune.includes(r.id)))
            return;
        for (const mod of this.modules) {
            try {
                const cfg = this.getModuleConfig(mod.name);
                if (!cfg || !cfg.enabled)
                    continue;
                if (cfg.shadow_mode)
                    continue;
                if (cfg.channel_ignore_list.includes(channel.id))
                    continue;
                if (cfg.immune_roles.length > 0 && member.roles.cache.some((r) => cfg.immune_roles.includes(r.id)))
                    continue;
                const hit = await mod.check({ app: this.app, member, message, channel, content: message.content });
                if (!hit)
                    continue;
                await this.handleHit(hit, member, message, channel, cfg);
            }
            catch (err) {
                this.app.logger.error(`Automod module ${mod.name} threw:`, err);
                await this.app.logManager.reportError(`Automod module ${mod.name}`, err);
            }
        }
    }
    getModuleConfig(moduleName) {
        const modules = this.app.config.automod.modules;
        if (modules[moduleName]) {
            return modules[moduleName] ?? null;
        }
        const heuristics = this.app.config.automod.heuristics;
        if (heuristics[moduleName]) {
            return heuristics[moduleName] ?? null;
        }
        return null;
    }
    async handleJoin(member) {
        if (!this.app.config.automod.enabled)
            return;
        const guild = member.guild;
        const globalImmune = this.app.config.automod.global_immune_roles;
        if (member.roles.cache.some((r) => globalImmune.includes(r.id)))
            return;
        for (const moduleName of ['mass_identical_joins', 'new_account_velocity']) {
            try {
                const cfg = this.getModuleConfig(moduleName);
                if (!cfg || !cfg.enabled || cfg.shadow_mode)
                    continue;
                const mod = this.joinModules.get(moduleName);
                if (!mod)
                    continue;
                const hit = await mod.check({ app: this.app, member, content: '' });
                if (!hit)
                    continue;
                await this.handleHit(hit, member, null, null, cfg);
            }
            catch (err) {
                this.app.logger.error(`Automod join heuristic ${moduleName} threw:`, err);
                await this.app.logManager.reportError(`Automod join heuristic ${moduleName}`, err);
            }
        }
    }
    async handleNickname(member, nickname) {
        if (!this.app.config.regex_engine.enabled)
            return;
        const cfg = this.getModuleConfig('regex_engine');
        if (!cfg || !cfg.enabled || cfg.shadow_mode)
            return;
        const mod = this.modules.find((m) => m.name === 'regex_engine');
        if (!mod)
            return;
        try {
            const hit = await mod.check({ app: this.app, member, content: nickname });
            if (hit && hit.rule) {
                await this.handleHit(hit, member, null, null, cfg);
            }
        }
        catch (err) {
            this.app.logger.error('Automod nickname check threw:', err);
        }
    }
    async handleHit(hit, member, message, channel, cfg) {
        const guild = member.guild;
        await this.app.db.execute(`INSERT INTO automod_triggers (guild_id, rule, module, user_id, channel_id, message_id, content_snippet)
       VALUES (?, ?, ?, ?, ?, ?, ?)`, [guild.id, hit.rule, hit.module, member.id, channel?.id ?? null, message?.id ?? null, hit.content.slice(0, 500)]);
        if (this.app.config.automod.risk_scoring.enabled) {
            await this.app.riskScoring.add(member.id, this.app.config.automod.risk_scoring.automod_hit_weight, guild.id);
        }
        const result = await this.executor.execute({
            rule: hit.rule,
            module: hit.module,
            guild,
            user: member.user,
            member,
            message: message ?? null,
            channel: channel ?? null,
            reason: hit.reason,
            content: hit.content,
        }, cfg.action_chain, cfg.suppress_repeat_response_seconds, cfg.suppressed_response_mode);
        await this.app.logManager.logAutomodTrigger({
            guildId: guild.id,
            rule: hit.rule,
            module: hit.module,
            userId: member.id,
            channelId: channel?.id ?? null,
            messageId: message?.id ?? null,
            contentSnippet: hit.content.slice(0, 500),
            storedContent: hit.content,
            actionsTaken: result.actionsTaken,
            actionsFailed: result.actionsFailed,
            responseSuppressed: result.responseSuppressed,
            caseIds: result.caseIds,
        });
        if (result.responseSuppressed && cfg.suppressed_response_mode === 'batched_summary' && channel) {
            this.maybePostSummary(hit, member, channel, cfg);
        }
    }
    maybePostSummary(hit, member, channel, cfg) {
        const summary = this.throttle.consumeSummary(hit.rule, channel.id);
        if (!summary || summary.count === 0)
            return;
        const text = `Removed ${summary.count} message(s) / actioned ${summary.users} user(s) for ${hit.module} (${hit.rule}) in the last window.`;
        channel.send({ content: text }).catch(() => undefined);
    }
}
exports.AutomodManager = AutomodManager;
//# sourceMappingURL=manager.js.map