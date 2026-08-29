import type { RowDataPacket } from 'mysql2/promise';
import { AuditLogEvent, type GuildMember } from 'discord.js';
import type { App } from '../core/context';
import { resolveAuditActor } from '../utils/auditLog';

export async function handleGuildMemberUpdate(app: App, oldMember: GuildMember, newMember: GuildMember): Promise<void> {
  try {
    const guild = newMember.guild;

    const oldRoles = new Set(oldMember.roles.cache.keys());
    const newRoles = new Set(newMember.roles.cache.keys());

    const addedRoles = [...newRoles].filter((id) => !oldRoles.has(id));
    const removedRoles = [...oldRoles].filter((id) => !newRoles.has(id));
    const rolesChanged = addedRoles.length > 0 || removedRoles.length > 0;
    const roleActorId = rolesChanged
      ? await resolveAuditActor(app, guild, AuditLogEvent.MemberRoleUpdate, { targetId: newMember.id, retries: 2 })
      : null;

    if (rolesChanged) {
      const both = addedRoles.length > 0 && removedRoles.length > 0;
      const event = both ? 'role_change' : addedRoles.length > 0 ? 'role_add' : 'role_remove';
      const verb = both ? 'roles updated' : addedRoles.length > 0 ? 'was given roles' : 'lost roles';
      await app.logManager.log({
        event,
        guildId: guild.id,
        actorId: roleActorId,
        targetId: newMember.id,
        message: `<@${newMember.id}> ${verb}`,
        details: {
          ...(addedRoles.length > 0 ? { added: addedRoles } : {}),
          ...(removedRoles.length > 0 ? { removed: removedRoles } : {}),
        },
      });
    }

    if (oldMember.nickname !== newMember.nickname) {
      const nickActorId = await resolveAuditActor(app, guild, AuditLogEvent.MemberUpdate, { targetId: newMember.id });
      await app.logManager.log({
        event: 'nickname_change',
        guildId: guild.id,
        actorId: nickActorId,
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

    // Role connections re-sync on any role add / remove / update for the member.
    if (rolesChanged) {
      await app.roleConnections.syncMember(newMember);
    }
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
    const actorId = await resolveAuditActor(app, newMember.guild, AuditLogEvent.MemberUpdate, { targetId: newMember.id });
    await app.logManager.log({
      event: 'member_mute',
      guildId: newMember.guild.id,
      actorId,
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
  // A renewable long mute just crossed a 28-day chunk boundary — the scheduler
  // re-applies it, so a "member unmuted" log here would be misleading.
  if (await app.punishmentManager.isRenewableMute(newMember.guild.id, newMember.id)) return;
  await app.logManager.log({
    event: 'member_unmute',
    guildId: newMember.guild.id,
    targetId: newMember.id,
    message: `<@${newMember.id}> was unmuted${expired ? ' (timeout expired)' : ''}`,
    details: { source: expired ? 'expired' : 'native' },
  });
}

export default { name: 'guildMemberUpdate', run: handleGuildMemberUpdate };