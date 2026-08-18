import type { Role } from 'discord.js';
import type { App } from '../core/context';

export async function handleRoleCreate(app: App, role: Role): Promise<void> {
  if (role.managed) return;
  await app.logManager.log({
    event: 'role_create',
    guildId: role.guild.id,
    channelId: null,
    message: `Role created: @${role.name}`,
    details: { name: role.name, roleId: role.id, color: `#${role.color.toString(16).padStart(6, '0')}` },
  });
}

export default { name: 'roleCreate', run: handleRoleCreate };