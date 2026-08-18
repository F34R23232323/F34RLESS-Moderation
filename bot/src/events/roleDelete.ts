import type { Role } from 'discord.js';
import type { App } from '../core/context';

export async function handleRoleDelete(app: App, role: Role): Promise<void> {
  if (role.managed) return;
  await app.logManager.log({
    event: 'role_delete',
    guildId: role.guild.id,
    message: `Role deleted: @${role.name}`,
    details: { roleId: role.id, name: role.name },
  });
}

export default { name: 'roleDelete', run: handleRoleDelete };