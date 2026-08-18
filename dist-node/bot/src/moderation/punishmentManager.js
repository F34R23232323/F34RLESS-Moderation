"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PunishmentManager = void 0;
const discord_js_1 = require("discord.js");
const index_1 = require("../../../shared/src/index");
class PunishmentManager {
    app;
    constructor(app) {
        this.app = app;
    }
    async dmBefore(type, guild, user, options, durationMs) {
        if (this.app.config.punishment_dms.order !== 'before')
            return false;
        return this.app.punishmentDm.send(type, {
            guild,
            user,
            reason: options.reason,
            moderator: options.moderatorId ? (await guild.members.fetch(options.moderatorId).catch(() => null))?.displayName ?? undefined : undefined,
            durationMs: options.durationMs ?? durationMs,
        });
    }
    async dmAfter(type, guild, user, caseRow, options) {
        if (this.app.config.punishment_dms.order !== 'after')
            return false;
        return this.app.punishmentDm.send(type, {
            guild,
            user,
            reason: options.reason,
            moderator: options.moderatorId ? (await guild.members.fetch(options.moderatorId).catch(() => null))?.displayName ?? undefined : undefined,
            durationMs: options.durationMs,
            caseId: caseRow.case_number,
        });
    }
    async warn(target, options) {
        const guild = target instanceof discord_js_1.GuildMember ? target.guild : (await this.resolveGuild());
        if (!guild)
            return { ok: false, error: 'guild not resolved', dmSent: false };
        const user = target instanceof discord_js_1.GuildMember ? target.user : target;
        const dmSent = await this.dmBefore('warn', guild, user, options);
        const caseRow = await this.app.caseService.createCase({
            guildId: guild.id,
            type: 'warn',
            userId: target.id,
            moderatorId: options.moderatorId ?? null,
            reason: options.reason ?? 'No reason provided',
            evidence: options.evidence,
        });
        await this.app.db.execute(`INSERT INTO warnings (guild_id, user_id, case_id, moderator_id, reason, expires_at)
       VALUES (?, ?, ?, ?, ?, ?)`, [
            guild.id,
            target.id,
            caseRow.id,
            options.moderatorId ?? null,
            options.reason ?? 'No reason provided',
            this.app.config.warnings.decay.enabled
                ? new Date(Date.now() + this.app.config.warnings.decay.after_days * 86400000)
                : null,
        ]);
        await this.dmAfter('warn', guild, user, caseRow, options);
        await this.app.logManager.log({
            event: 'moderation_action',
            guildId: guild.id,
            actorId: options.moderatorId ?? null,
            targetId: target.id,
            message: `Warned <@${target.id}> (case #${caseRow.case_number})`,
            details: { type: 'warn', caseId: caseRow.id, reason: options.reason },
        });
        await this.app.warningEscalation.check(guild.id, target.id);
        return { ok: true, case: caseRow, dmSent };
    }
    async timeout(target, durationMs, options) {
        const dmSent = await this.dmBefore('mute', target.guild, target.user, options, durationMs);
        try {
            await target.timeout(durationMs, options.reason ?? undefined);
        }
        catch (err) {
            return { ok: false, error: err.message, dmSent };
        }
        const caseRow = await this.app.caseService.createCase({
            guildId: target.guild.id,
            type: 'mute',
            userId: target.id,
            moderatorId: options.moderatorId ?? null,
            reason: options.reason ?? 'No reason provided',
            durationMs,
            evidence: options.evidence,
        });
        await this.app.db.execute(`INSERT INTO punishments (guild_id, user_id, type, case_id, expires_at)
       VALUES (?, ?, 'mute', ?, ?)`, [target.guild.id, target.id, caseRow.id, new Date(Date.now() + durationMs)]);
        await this.dmAfter('mute', target.guild, target.user, caseRow, options);
        await this.app.logManager.log({
            event: 'moderation_action',
            guildId: target.guild.id,
            actorId: options.moderatorId ?? null,
            targetId: target.id,
            message: `Muted <@${target.id}> for ${(0, index_1.humanizeDuration)(durationMs)} (case #${caseRow.case_number})`,
            details: { type: 'mute', durationMs, caseId: caseRow.id, reason: options.reason },
        });
        return { ok: true, case: caseRow, dmSent };
    }
    async unmute(target, options) {
        const dmSent = await this.dmBefore('unmute', target.guild, target.user, options);
        try {
            await target.timeout(null);
        }
        catch (err) {
            return { ok: false, error: err.message, dmSent };
        }
        await this.app.db.execute("UPDATE punishments SET active = 0 WHERE guild_id = ? AND user_id = ? AND type = 'mute' AND active = 1", [target.guild.id, target.id]);
        const caseRow = await this.app.caseService.createCase({
            guildId: target.guild.id,
            type: 'unmute',
            userId: target.id,
            moderatorId: options.moderatorId ?? null,
            reason: options.reason ?? 'Mute lifted',
        });
        await this.dmAfter('unmute', target.guild, target.user, caseRow, options);
        return { ok: true, case: caseRow, dmSent };
    }
    async kick(target, options) {
        const dmSent = await this.dmBefore('kick', target.guild, target.user, options);
        try {
            await target.kick(options.reason ?? undefined);
        }
        catch (err) {
            return { ok: false, error: err.message, dmSent };
        }
        const caseRow = await this.app.caseService.createCase({
            guildId: target.guild.id,
            type: 'kick',
            userId: target.id,
            moderatorId: options.moderatorId ?? null,
            reason: options.reason ?? 'No reason provided',
            evidence: options.evidence,
        });
        await this.dmAfter('kick', target.guild, target.user, caseRow, options);
        await this.app.logManager.log({
            event: 'moderation_action',
            guildId: target.guild.id,
            actorId: options.moderatorId ?? null,
            targetId: target.id,
            message: `Kicked <@${target.id}> (case #${caseRow.case_number})`,
            details: { type: 'kick', caseId: caseRow.id, reason: options.reason },
        });
        return { ok: true, case: caseRow, dmSent };
    }
    async ban(target, options) {
        const guild = target instanceof discord_js_1.GuildMember ? target.guild : (await this.resolveGuild());
        if (!guild)
            return { ok: false, error: 'guild not resolved', dmSent: false };
        const user = target instanceof discord_js_1.GuildMember ? target.user : target;
        const dmSent = await this.dmBefore('ban', guild, user, options, options.durationMs);
        try {
            await guild.bans.create(target.id, {
                reason: options.reason ?? undefined,
                deleteMessageSeconds: options.deleteMessageDays ? options.deleteMessageDays * 86400 : 0,
            });
        }
        catch (err) {
            return { ok: false, error: err.message, dmSent };
        }
        const caseRow = await this.app.caseService.createCase({
            guildId: guild.id,
            type: options.durationMs ? 'tempban' : 'ban',
            userId: target.id,
            moderatorId: options.moderatorId ?? null,
            reason: options.reason ?? 'No reason provided',
            durationMs: options.durationMs,
            evidence: options.evidence,
        });
        if (options.durationMs) {
            await this.app.db.execute(`INSERT INTO punishments (guild_id, user_id, type, case_id, expires_at)
         VALUES (?, ?, 'ban', ?, ?)`, [guild.id, target.id, caseRow.id, new Date(Date.now() + options.durationMs)]);
        }
        await this.dmAfter('ban', guild, user, caseRow, options);
        await this.app.logManager.log({
            event: 'moderation_action',
            guildId: guild.id,
            actorId: options.moderatorId ?? null,
            targetId: target.id,
            message: `Banned <@${target.id}>${options.durationMs ? ` for ${(0, index_1.humanizeDuration)(options.durationMs)}` : ''} (case #${caseRow.case_number})`,
            details: { type: 'ban', caseId: caseRow.id, reason: options.reason, durationMs: options.durationMs },
        });
        return { ok: true, case: caseRow, dmSent };
    }
    async unban(guild, userId, options) {
        const user = await guild.client.users.fetch(userId).catch(() => null);
        const dmSent = user ? await this.dmBefore('unban', guild, user, options) : false;
        try {
            await guild.bans.remove(userId, options.reason ?? undefined);
        }
        catch (err) {
            return { ok: false, error: err.message, dmSent };
        }
        await this.app.db.execute("UPDATE punishments SET active = 0 WHERE guild_id = ? AND user_id = ? AND type = 'ban' AND active = 1", [guild.id, userId]);
        const caseRow = await this.app.caseService.createCase({
            guildId: guild.id,
            type: 'unban',
            userId,
            moderatorId: options.moderatorId ?? null,
            reason: options.reason ?? 'Ban lifted',
        });
        if (user)
            await this.dmAfter('unban', guild, user, caseRow, options);
        return { ok: true, case: caseRow, dmSent };
    }
    async softban(target, options) {
        const guild = target instanceof discord_js_1.GuildMember ? target.guild : (await this.resolveGuild());
        if (!guild)
            return { ok: false, error: 'guild not resolved', dmSent: false };
        const user = target instanceof discord_js_1.GuildMember ? target.user : target;
        const dmSent = await this.dmBefore('kick', guild, user, options);
        try {
            await guild.bans.create(target.id, {
                reason: `${options.reason ?? 'Softban'} (softban)`,
                deleteMessageSeconds: (options.deleteMessageDays ?? 7) * 86400,
            });
            await guild.bans.remove(target.id, 'softban automatic unban');
        }
        catch (err) {
            return { ok: false, error: err.message, dmSent };
        }
        const caseRow = await this.app.caseService.createCase({
            guildId: guild.id,
            type: 'softban',
            userId: target.id,
            moderatorId: options.moderatorId ?? null,
            reason: options.reason ?? 'No reason provided',
            evidence: options.evidence,
        });
        await this.dmAfter('kick', guild, user, caseRow, options);
        return { ok: true, case: caseRow, dmSent };
    }
    async tempRole(target, roleId, durationMs, options) {
        try {
            await target.roles.add(roleId, options.reason ?? undefined);
        }
        catch (err) {
            return { ok: false, error: err.message, dmSent: false };
        }
        await this.app.db.execute(`INSERT INTO punishments (guild_id, user_id, type, role_id, case_id, expires_at)
       VALUES (?, ?, 'temp_role', ?, NULL, ?)`, [target.guild.id, target.id, roleId, new Date(Date.now() + durationMs)]);
        const caseRow = await this.app.caseService.createCase({
            guildId: target.guild.id,
            type: 'temp_role',
            userId: target.id,
            moderatorId: options.moderatorId ?? null,
            reason: options.reason ?? `Temporary role <@&${roleId}>`,
            durationMs,
        });
        return { ok: true, case: caseRow, dmSent: false };
    }
    async applyFromAction(guild, type, target, options) {
        switch (type) {
            case 'warn':
                return this.warn(target, options);
            case 'mute':
            case 'timeout':
                if (!(target instanceof discord_js_1.GuildMember))
                    return { ok: false, error: 'target must be a member', dmSent: false };
                return this.timeout(target, options.durationMs ?? 3600000, options);
            case 'kick':
                if (!(target instanceof discord_js_1.GuildMember))
                    return { ok: false, error: 'target must be a member', dmSent: false };
                return this.kick(target, options);
            case 'ban':
                return this.ban(target, options);
            case 'softban':
                return this.softban(target, options);
            default:
                return { ok: false, error: `unknown action type ${type}`, dmSent: false };
        }
    }
    async resolveGuild() {
        return this.app.client.guilds.cache.first() ?? null;
    }
}
exports.PunishmentManager = PunishmentManager;
//# sourceMappingURL=punishmentManager.js.map