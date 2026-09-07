import { AuditLogEvent, type Role } from 'discord.js';
import type { App } from '../core/context';
import { resolveAuditActor } from '../utils/auditLog';

export async function handleRoleDelete(app: App, role: Role): Promise<void> {
  if (role.managed) return;
  await app.antiNuke.observe({ guild: role.guild, type: 'role_delete', targetType: 'role', targetId: role.id,
    before: { name: role.name, permissions: role.permissions.bitfield.toString() } });
  const actorId = await resolveAuditActor(app, role.guild, AuditLogEvent.RoleDelete, { targetId: role.id });
  await app.logManager.log({
    event: 'role_delete',
    guildId: role.guild.id,
    actorId,
    message: `Role deleted: @${role.name}`,
    details: { roleId: role.id, name: role.name },
  });
  // Members lost this role implicitly — re-sync anyone affected by a connection.
  app.roleConnections.onRoleChanged(role.guild.id, role.id);
}

export default { name: 'roleDelete', run: handleRoleDelete };
