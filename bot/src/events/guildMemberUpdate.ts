import type { RowDataPacket } from 'mysql2/promise';
import type { GuildMember } from 'discord.js';
import type { App } from '../core/context';

export async function handleGuildMemberUpdate(app: App, oldMember: GuildMember, newMember: GuildMember): Promise<void> {
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

      const [locks] = await app.db.query<RowDataPacket[]>(
        'SELECT locked_nick FROM nick_locks WHERE guild_id = ? AND user_id = ? AND active = 1',
        [guild.id, newMember.id],
      );
      const lock = locks[0];
      if (lock && lock.locked_nick !== newMember.nickname) {
        await newMember.setNickname(lock.locked_nick, 'Nickname locked').catch(() => undefined);
      }
    }

    const oldBoost = oldMember.premiumSinceTimestamp ?? null;
    const newBoost = newMember.premiumSinceTimestamp ?? null;
    if (oldBoost !== newBoost) {
      if (newBoost) {
        await app.logManager.log({
          event: 'member_boost',
          guildId: guild.id,
          targetId: newMember.id,
          message: `<@${newMember.id}> boosted the server`,
        });
      } else {
        await app.logManager.log({
          event: 'member_unboost',
          guildId: guild.id,
          targetId: newMember.id,
          message: `<@${newMember.id}> stopped boosting`,
        });
      }
    }

    await handleMuteChange(app, oldMember, newMember);

    await runRoleConnections(app, newMember, oldRoles, newRoles);
  } catch (err) {
    app.logger.error('guildMemberUpdate handler threw:', err);
  }
}

async function handleMuteChange(app: App, oldMember: GuildMember, newMember: GuildMember): Promise<void> {
  const oldDisabled = oldMember.isCommunicationDisabled();
  const newDisabled = newMember.isCommunicationDisabled();
  if (oldDisabled === newDisabled) return;

  const action = newDisabled ? 'mute' : 'unmute';
  // If the bot performed this change itself (via /mute, /timeout, /unmute,
  // automod or escalation), that flow already logged it — skip the duplicate.
  if (app.punishmentManager.consumeMuteSuppression(newMember.guild.id, newMember.id, action)) return;

  if (newDisabled) {
    const until = newMember.communicationDisabledUntil;
    await app.logManager.log({
      event: 'member_mute',
      guildId: newMember.guild.id,
      targetId: newMember.id,
      message: `<@${newMember.id}> was muted (timeout applied)${until ? ` until <t:${Math.floor(until.getTime() / 1000)}:R>` : ''}`,
      details: { source: 'native', until: until?.toISOString() ?? null },
    });
    return;
  }

  // Unmuted. Detect whether it was a timeout that simply expired.
  let expired = false;
  try {
    const [rows] = await app.db.query<RowDataPacket[]>(
      "SELECT expires_at FROM punishments WHERE guild_id = ? AND user_id = ? AND type = 'mute' AND active = 1 ORDER BY expires_at DESC LIMIT 1",
      [newMember.guild.id, newMember.id],
    );
    if (rows[0] && new Date(rows[0].expires_at).getTime() <= Date.now()) expired = true;
  } catch {
    // ignore
  }
  await app.logManager.log({
    event: 'member_unmute',
    guildId: newMember.guild.id,
    targetId: newMember.id,
    message: `<@${newMember.id}> was unmuted${expired ? ' (timeout expired)' : ''}`,
    details: { source: expired ? 'expired' : 'native' },
  });
}

async function runRoleConnections(app: App, member: GuildMember, oldRoles: Set<string>, newRoles: Set<string>): Promise<void> {
  for (const conn of app.config.role_connections) {
    if (!conn.enabled) continue;
    if (!newRoles.has(conn.if_has_role)) continue;
    if (oldRoles.has(conn.if_has_role)) continue;

    if (conn.held_for_seconds > 0) {
      app.scheduler.setTimeout(`roleconn:${member.id}:${conn.if_has_role}`, conn.held_for_seconds * 1000, async () => {
        const fresh = await member.guild.members.fetch(member.id).catch(() => null);
        if (!fresh || !fresh.roles.cache.has(conn.if_has_role)) return;
        await applyConnection(app, fresh, conn);
      });
    } else {
      await applyConnection(app, member, conn);
    }
  }
}

async function applyConnection(app: App, member: GuildMember, conn: { then_add: string[]; then_remove: string[] }): Promise<void> {
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
export default { name: 'guildMemberUpdate', run: handleGuildMemberUpdate };