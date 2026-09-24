import type { User, PartialUser } from 'discord.js';
import type { App } from '../core/context';
import { runImpersonationCheck } from '../security/impersonation';

export async function handleUserUpdate(app: App, oldUser: User | PartialUser, newUser: User): Promise<void> {
  try {
    const guild = app.client.guilds.cache.find((g) => g.members.cache.has(newUser.id));
    const guildId = guild?.id ?? app.config.bot.owner_ids[0] ?? '0';
    const isBot = newUser.bot ? ' (bot)' : '';

    if (oldUser.avatar !== newUser.avatar) {
      const avatarUrl = newUser.displayAvatarURL({ size: 256 });
      await app.logManager.log({
        event: 'member_avatar_update',
        guildId,
        targetId: newUser.id,
        message: `<@${newUser.id}>${isBot} updated their avatar`,
        details: { userId: newUser.id },
        mediaUrls: [avatarUrl],
      });
    }

    const oldName = oldUser.username;
    const newName = newUser.username;
    const oldGlobal = (oldUser as User).globalName ?? oldUser.username;
    const newGlobal = newUser.globalName ?? newUser.username;
    if (oldName !== newName || oldGlobal !== newGlobal) {
      const parts: string[] = [];
      if (oldName !== newName) parts.push(`username: **${oldName}** → **${newName}**`);
      if (oldGlobal !== newGlobal) parts.push(`global name: **${oldGlobal}** → **${newGlobal}**`);
      await app.logManager.log({
        event: 'member_username_update',
        guildId,
        targetId: newUser.id,
        message: `<@${newUser.id}>${isBot} updated their username`,
        details: { userId: newUser.id, changes: parts },
      });

      for (const g of app.client.guilds.cache.values()) {
        const member = g.members.cache.get(newUser.id);
        if (member) await runImpersonationCheck(app, member, 'username_change');
      }
    }
  } catch (err) {
    app.logger.error('userUpdate handler threw:', err);
  }
}

export default { name: 'userUpdate', run: handleUserUpdate };