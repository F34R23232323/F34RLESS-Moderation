import { AuditLogEvent, PermissionsBitField, type Role } from 'discord.js';
import type { App } from '../core/context';
import { resolveAuditActor } from '../utils/auditLog';

function permNames(bits: bigint): string[] {
  return new PermissionsBitField(bits).toArray();
}

export async function handleRoleUpdate(app: App, oldRole: Role, newRole: Role): Promise<void> {
  if (newRole.managed) return;
  const changes: string[] = [];
  if (oldRole.name !== newRole.name) changes.push(`Name: ${oldRole.name} -> ${newRole.name}`);
  if (oldRole.color !== newRole.color) changes.push(`Color: #${oldRole.color.toString(16)} -> #${newRole.color.toString(16)}`);
  if (oldRole.hoist !== newRole.hoist) changes.push(`Hoisted: ${oldRole.hoist} -> ${newRole.hoist}`);
  if (oldRole.mentionable !== newRole.mentionable) changes.push(`Mentionable: ${oldRole.mentionable} -> ${newRole.mentionable}`);

  // Permission changes
  if (oldRole.permissions.bitfield !== newRole.permissions.bitfield) {
    const oldPerms = new Set(permNames(oldRole.permissions.bitfield));
    const newPerms = new Set(permNames(newRole.permissions.bitfield));
    const added = [...newPerms].filter((p) => !oldPerms.has(p));
    const removed = [...oldPerms].filter((p) => !newPerms.has(p));
    if (added.length > 0) changes.push(`Permissions added: ${added.join(', ')}`);
    if (removed.length > 0) changes.push(`Permissions removed: ${removed.join(', ')}`);
  }

  if (changes.length === 0) return;
  const actorId = await resolveAuditActor(app, newRole.guild, AuditLogEvent.RoleUpdate, { targetId: newRole.id, retries: 2 });
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