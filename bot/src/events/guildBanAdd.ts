import type { GuildBan } from 'discord.js';
import type { App } from '../core/context';

export async function handleGuildBanAdd(app: App, ban: GuildBan): Promise<void> {
  await app.logManager.log({
    event: 'member_ban',
    guildId: ban.guild.id,
    targetId: ban.user.id,
    message: `<@${ban.user.id}> was banned (${ban.reason ?? 'no reason'})`,
    details: { reason: ban.reason },
  });
}

export default { name: 'guildBanAdd', run: handleGuildBanAdd };