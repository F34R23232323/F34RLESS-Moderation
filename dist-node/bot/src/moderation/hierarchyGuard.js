"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ModerationCommandGuard = void 0;
class ModerationCommandGuard {
    app;
    constructor(app) {
        this.app = app;
    }
    isOwner(userId) {
        return this.app.config.bot.owner_ids.includes(userId) || userId === this.app.env.OWNER_USER_ID;
    }
    isImmune(target, command) {
        const cfg = this.app.config.commands[command.name];
        const immuneIds = cfg?.immune_roles ?? [];
        if (immuneIds.length === 0)
            return false;
        return target.roles.cache.some((r) => immuneIds.includes(r.id));
    }
    hasRequiredPermissions(member, command) {
        if (this.isOwner(member.id))
            return { ok: true };
        const cfg = this.app.config.commands[command.name];
        if (cfg?.permission_group) {
            const group = this.app.config.staff_permission_groups.groups.find((g) => g.name === cfg.permission_group);
            if (group) {
                const holdsGroupRole = member.roles.cache.some((r) => group.roles.includes(r.id));
                if (!holdsGroupRole) {
                    return { ok: false, reason: `requires membership in staff group "${group.name}"` };
                }
                if (!group.permissions.includes(command.name) && !group.permissions.includes('*')) {
                    return { ok: false, reason: `group "${group.name}" does not include "${command.name}"` };
                }
            }
        }
        const required = command.permissions ?? [];
        if (required.length === 0)
            return { ok: true };
        const missing = required.filter((perm) => !member.permissions.has(perm));
        if (missing.length > 0) {
            return { ok: false, reason: `missing permission(s): ${missing.join(', ')}` };
        }
        return { ok: true };
    }
    canModerate(target, staff) {
        if (this.isOwner(staff.id))
            return { ok: true };
        if (target.id === staff.id)
            return { ok: false, reason: 'you cannot moderate yourself' };
        const botMember = this.app.client.guilds.cache.get(target.guild.id)?.members.me;
        if (botMember && !this.isHigher(botMember, target)) {
            return { ok: false, reason: 'the bot is below the target in the role hierarchy' };
        }
        if (!this.isHigher(staff, target)) {
            return { ok: false, reason: 'you are below the target in the role hierarchy' };
        }
        return { ok: true };
    }
    isHigher(a, b) {
        return a.roles.highest.position > b.roles.highest.position || (a.roles.highest.position === b.roles.highest.position && a.id !== b.id);
    }
    isAboveRole(staff, role) {
        const botMember = this.app.client.guilds.cache.get(staff.guild.id)?.members.me;
        if (botMember && role.position >= botMember.roles.highest.position) {
            return { ok: false, reason: 'the bot is not high enough to manage that role' };
        }
        if (role.position >= staff.roles.highest.position) {
            return { ok: false, reason: 'you cannot manage that role' };
        }
        return { ok: true };
    }
}
exports.ModerationCommandGuard = ModerationCommandGuard;
//# sourceMappingURL=hierarchyGuard.js.map