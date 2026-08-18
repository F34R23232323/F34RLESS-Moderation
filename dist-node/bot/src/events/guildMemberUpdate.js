"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleGuildMemberUpdate = handleGuildMemberUpdate;
async function handleGuildMemberUpdate(app, oldMember, newMember) {
    try {
        const guild = newMember.guild;
        const oldRoles = new Set(oldMember.roles.cache.keys());
        const newRoles = new Set(newMember.roles.cache.keys());
        for (const roleId of newRoles) {
            if (!oldRoles.has(roleId)) {
                await app.logManager.log({
                    event: 'role_add',
                    guildId: guild.id,
                    targetId: newMember.id,
                    message: `<@${newMember.id}> was given <@&${roleId}>`,
                    details: { roleId },
                });
            }
        }
        for (const roleId of oldRoles) {
            if (!newRoles.has(roleId)) {
                await app.logManager.log({
                    event: 'role_remove',
                    guildId: guild.id,
                    targetId: newMember.id,
                    message: `<@${newMember.id}> lost <@&${roleId}>`,
                    details: { roleId },
                });
            }
        }
        if (oldMember.nickname !== newMember.nickname) {
            await app.logManager.log({
                event: 'nickname_change',
                guildId: guild.id,
                targetId: newMember.id,
                message: `<@${newMember.id}> nickname changed`,
                details: { old: oldMember.nickname, new: newMember.nickname },
            });
            await app.automod.handleNickname(newMember, newMember.nickname ?? newMember.user.username);
            const [locks] = await app.db.query('SELECT locked_nick FROM nick_locks WHERE guild_id = ? AND user_id = ? AND active = 1', [guild.id, newMember.id]);
            const lock = locks[0];
            if (lock && lock.locked_nick !== newMember.nickname) {
                await newMember.setNickname(lock.locked_nick, 'Nickname locked').catch(() => undefined);
            }
        }
        await runRoleConnections(app, newMember, oldRoles, newRoles);
    }
    catch (err) {
        app.logger.error('guildMemberUpdate handler threw:', err);
    }
}
async function runRoleConnections(app, member, oldRoles, newRoles) {
    for (const conn of app.config.role_connections) {
        if (!conn.enabled)
            continue;
        if (!newRoles.has(conn.if_has_role))
            continue;
        if (oldRoles.has(conn.if_has_role))
            continue;
        if (conn.held_for_seconds > 0) {
            app.scheduler.setTimeout(`roleconn:${member.id}:${conn.if_has_role}`, conn.held_for_seconds * 1000, async () => {
                const fresh = await member.guild.members.fetch(member.id).catch(() => null);
                if (!fresh || !fresh.roles.cache.has(conn.if_has_role))
                    return;
                await applyConnection(app, fresh, conn);
            });
        }
        else {
            await applyConnection(app, member, conn);
        }
    }
}
async function applyConnection(app, member, conn) {
    for (const roleId of conn.then_add) {
        if (!member.roles.cache.has(roleId)) {
            await member.roles.add(roleId, 'Role connection').catch(() => undefined);
        }
    }
    for (const roleId of conn.then_remove) {
        if (member.roles.cache.has(roleId)) {
            await member.roles.remove(roleId, 'Role connection').catch(() => undefined);
        }
    }
}
exports.default = { name: 'guildMemberUpdate', run: handleGuildMemberUpdate };
//# sourceMappingURL=guildMemberUpdate.js.map