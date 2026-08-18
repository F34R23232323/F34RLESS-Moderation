import type { GuildBan } from 'discord.js';
import type { App } from '../core/context';

export async function handleGuildBanRemove(app: App, ban: GuildBan): Promise<void> {
  await app.logManager.log({
    event: 'member_unban',
    guildId: ban.guild.id,
    targetId: ban.user.id,
    message: `<@${ban.user.id}> was unbanned`,
  });
}

export default { name: 'guildBanRemove', run: handleGuildBanRemove };