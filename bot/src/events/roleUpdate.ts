import type { Role } from 'discord.js';
import type { App } from '../core/context';

export async function handleRoleUpdate(app: App, oldRole: Role, newRole: Role): Promise<void> {
  if (newRole.managed) return;
  const changes: string[] = [];
  if (oldRole.name !== newRole.name) changes.push(`Name: ${oldRole.name} -> ${newRole.name}`);
  if (oldRole.color !== newRole.color) changes.push(`Color: #${oldRole.color.toString(16)} -> #${newRole.color.toString(16)}`);
  if (oldRole.hoist !== newRole.hoist) changes.push(`Hoisted: ${oldRole.hoist} -> ${newRole.hoist}`);
  if (oldRole.mentionable !== newRole.mentionable) changes.push(`Mentionable: ${oldRole.mentionable} -> ${newRole.mentionable}`);
  if (changes.length === 0) return;
  await app.logManager.log({
    event: 'role_update',
    guildId: newRole.guild.id,
    message: `Role updated: @${newRole.name}`,
    details: { roleId: newRole.id, name: newRole.name, changes },
  });
}

export default { name: 'roleUpdate', run: handleRoleUpdate };