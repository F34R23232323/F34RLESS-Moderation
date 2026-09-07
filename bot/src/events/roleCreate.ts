import { AuditLogEvent, type Role } from 'discord.js';
import type { App } from '../core/context';
import { resolveAuditActor } from '../utils/auditLog';

export async function handleRoleCreate(app: App, role: Role): Promise<void> {
  if (role.managed) return;
  await app.antiNuke.observe({ guild: role.guild, type: 'role_create', targetType: 'role', targetId: role.id,
    after: { name: role.name, permissions: role.permissions.bitfield.toString() } });
  const actorId = await resolveAuditActor(app, role.guild, AuditLogEvent.RoleCreate, { targetId: role.id });
  await app.logManager.log({
    event: 'role_create',
    guildId: role.guild.id,
    channelId: null,
    actorId,
    message: `Role created: @${role.name}`,
    details: { name: role.name, roleId: role.id, color: `#${role.color.toString(16).padStart(6, '0')}` },
  });
}

export default { name: 'roleCreate', run: handleRoleCreate };
