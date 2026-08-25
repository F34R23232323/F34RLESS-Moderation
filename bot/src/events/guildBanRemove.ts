import { AuditLogEvent, type GuildBan } from 'discord.js';
import type { App } from '../core/context';
import { resolveAuditActor } from '../utils/auditLog';

export async function handleGuildBanRemove(app: App, ban: GuildBan): Promise<void> {
  const actorId = await resolveAuditActor(app, ban.guild, AuditLogEvent.MemberBanRemove, { targetId: ban.user.id });
  await app.logManager.log({
    event: 'member_unban',
    guildId: ban.guild.id,
    actorId,
    targetId: ban.user.id,
    message: `<@${ban.user.id}> was unbanned`,
  });
}

export default { name: 'guildBanRemove', run: handleGuildBanRemove };