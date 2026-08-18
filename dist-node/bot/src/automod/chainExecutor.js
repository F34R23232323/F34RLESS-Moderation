"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ActionChainExecutor = void 0;
const index_1 = require("../../../shared/src/index");
const v2_1 = require("../utils/v2");
class ActionChainExecutor {
    app;
    throttle;
    constructor(app, throttle) {
        this.app = app;
        this.throttle = throttle;
    }
    async execute(trigger, chain, suppressSeconds = 0, suppressMode = 'silent') {
        const result = {
            actionsTaken: [],
            actionsFailed: [],
            caseIds: [],
            responseSuppressed: false,
            suppressDecision: null,
            throttleMode: suppressMode,
        };
        const member = trigger.member ?? (trigger.user ? await trigger.guild.members.fetch(trigger.user.id).catch(() => null) : null);
        for (const step of chain) {
            try {
                await this.executeStep(step, trigger, member, result, suppressSeconds, suppressMode);
            }
            catch (err) {
                result.actionsFailed.push({ step: step.type, error: err.message });
            }
        }
        return result;
    }
    async executeStep(step, trigger, member, result, suppressSeconds, suppressMode) {
        const placeholders = {
            user: `<@${trigger.user.id}>`,
            'user.tag': trigger.user.tag,
            rule: trigger.rule,
            reason: trigger.reason ?? 'automated moderation',
            message_content: (trigger.content ?? '').slice(0, 1000),
            channel: trigger.channel ? `<#${trigger.channel.id}>` : 'unknown',
            punishment: step.type,
            duration: 'duration' in step && step.duration ? String(step.duration) : '',
            guild: trigger.guild.name,
        };
        switch (step.type) {
            case 'delete_message':
                if (trigger.message?.deletable) {
                    await trigger.message.delete();
                    result.actionsTaken.push('delete_message');
                }
                else {
                    throw new Error('message not deletable');
                }
                break;
            case 'send_channel_message': {
                const channel = trigger.channel;
                if (!channel)
                    throw new Error('no channel');
                const decision = this.throttle.shouldSuppress(trigger.rule, channel.id, trigger.user.id, suppressSeconds, suppressMode);
                if (decision.suppressSend) {
                    result.responseSuppressed = true;
                    result.suppressDecision = decision;
                    break;
                }
                const content = (0, index_1.renderPlaceholders)(step.content, placeholders);
                await this.sendFormatted(channel, content, step.format, step.delete_after_seconds || undefined);
                result.actionsTaken.push('send_channel_message');
                break;
            }
            case 'dm_user': {
                const content = (0, index_1.renderPlaceholders)(step.content, placeholders);
                const payload = this.buildFormatted(content, step.format);
                const dm = await trigger.user.createDM().catch(() => null);
                if (!dm)
                    throw new Error('cannot DM user');
                await dm.send(payload);
                result.actionsTaken.push('dm_user');
                break;
            }
            case 'warn': {
                if (!member)
                    throw new Error('no member');
                const warnResult = await this.app.punishmentManager.warn(member, {
                    reason: (0, index_1.renderPlaceholders)(step.reason ?? 'Automod: {rule}', placeholders),
                    moderatorId: this.app.client.user?.id ?? null,
                    silent: true,
                });
                if (warnResult.case)
                    result.caseIds.push(warnResult.case.id);
                if (!warnResult.ok)
                    throw new Error(warnResult.error ?? 'warn failed');
                result.actionsTaken.push('warn');
                break;
            }
            case 'mute':
            case 'timeout': {
                if (!member)
                    throw new Error('no member');
                const durationMs = step.duration ? ((0, index_1.parseDuration)(step.duration)?.milliseconds ?? 0) : 3600000;
                const muteResult = await this.app.punishmentManager.timeout(member, durationMs, {
                    reason: (0, index_1.renderPlaceholders)(step.reason ?? 'Automod: {rule}', placeholders),
                    moderatorId: this.app.client.user?.id ?? null,
                    silent: true,
                });
                if (muteResult.case)
                    result.caseIds.push(muteResult.case.id);
                if (!muteResult.ok)
                    throw new Error(muteResult.error ?? 'timeout failed');
                result.actionsTaken.push('timeout');
                break;
            }
            case 'kick': {
                if (!member)
                    throw new Error('no member');
                const kickResult = await this.app.punishmentManager.kick(member, {
                    reason: (0, index_1.renderPlaceholders)(step.reason ?? 'Automod: {rule}', placeholders),
                    moderatorId: this.app.client.user?.id ?? null,
                    silent: true,
                });
                if (kickResult.case)
                    result.caseIds.push(kickResult.case.id);
                if (!kickResult.ok)
                    throw new Error(kickResult.error ?? 'kick failed');
                result.actionsTaken.push('kick');
                break;
            }
            case 'ban': {
                const banResult = await this.app.punishmentManager.ban(trigger.user, {
                    reason: (0, index_1.renderPlaceholders)(step.reason ?? 'Automod: {rule}', placeholders),
                    moderatorId: this.app.client.user?.id ?? null,
                    durationMs: step.duration ? ((0, index_1.parseDuration)(step.duration)?.milliseconds ?? 0) || undefined : undefined,
                    silent: true,
                });
                if (banResult.case)
                    result.caseIds.push(banResult.case.id);
                if (!banResult.ok)
                    throw new Error(banResult.error ?? 'ban failed');
                result.actionsTaken.push('ban');
                break;
            }
            case 'add_role': {
                if (!member)
                    throw new Error('no member');
                await member.roles.add(step.role_id, `Automod: ${trigger.rule}`);
                result.actionsTaken.push('add_role');
                break;
            }
            case 'remove_role': {
                if (!member)
                    throw new Error('no member');
                await member.roles.remove(step.role_id, `Automod: ${trigger.rule}`);
                result.actionsTaken.push('remove_role');
                break;
            }
            case 'run_escalation_check': {
                await this.app.punishmentEscalation.recordTrigger(trigger.guild.id, trigger.user.id, trigger.rule);
                result.actionsTaken.push('run_escalation_check');
                break;
            }
        }
    }
    buildFormatted(content, format) {
        if (format === 'plain')
            return { content };
        return (0, v2_1.buildV2Content)(content);
    }
    async sendFormatted(channel, content, format, deleteAfterSeconds) {
        const payload = this.buildFormatted(content, format);
        if (format === 'plain') {
            await channel.send({ content, deleteAfter: deleteAfterSeconds ?? 0 });
        }
        else {
            const sent = await channel.send({ ...payload });
            if (deleteAfterSeconds && deleteAfterSeconds > 0) {
                setTimeout(() => void sent.delete().catch(() => undefined), deleteAfterSeconds * 1000);
            }
        }
    }
}
exports.ActionChainExecutor = ActionChainExecutor;
//# sourceMappingURL=chainExecutor.js.map