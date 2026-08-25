import { AuditLogEvent, type Role } from 'discord.js';
import type { App } from '../core/context';
import { resolveAuditActor } from '../utils/auditLog';

export async function handleRoleUpdate(app: App, oldRole: Role, newRole: Role): Promise<void> {
  if (newRole.managed) return;
  const changes: string[] = [];
  if (oldRole.name !== newRole.name) changes.push(`Name: ${oldRole.name} -> ${newRole.name}`);
  if (oldRole.color !== newRole.color) changes.push(`Color: #${oldRole.color.toString(16)} -> #${newRole.color.toString(16)}`);
  if (oldRole.hoist !== newRole.hoist) changes.push(`Hoisted: ${oldRole.hoist} -> ${newRole.hoist}`);
  if (oldRole.mentionable !== newRole.mentionable) changes.push(`Mentionable: ${oldRole.mentionable} -> ${newRole.mentionable}`);
  if (changes.length === 0) return;
  const actorId = await resolveAuditActor(app, newRole.guild, AuditLogEvent.RoleUpdate, { targetId: newRole.id });
  await app.logManager.log({
    event: 'role_update',
    guildId: newRole.guild.id,
    actorId,
    message: `Role updated: @${newRole.name}`,
    details: { roleId: newRole.id, name: newRole.name, changes },
  });
  app.roleConnections.onRoleChanged(newRole.guild.id, newRole.id);
}

export default { name: 'roleUpdate', run: handleRoleUpdate };