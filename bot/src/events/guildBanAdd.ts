import { AuditLogEvent, type GuildBan } from 'discord.js';
import type { App } from '../core/context';
import { resolveAuditActor } from '../utils/auditLog';

export async function handleGuildBanAdd(app: App, ban: GuildBan): Promise<void> {
  const actorId = await resolveAuditActor(app, ban.guild, AuditLogEvent.MemberBanAdd, { targetId: ban.user.id });
  await app.logManager.log({
    event: 'member_ban',
    guildId: ban.guild.id,
    actorId,
    targetId: ban.user.id,
    message: `<@${ban.user.id}> was banned (${ban.reason ?? 'no reason'})`,
    details: { reason: ban.reason },
  });
}

export default { name: 'guildBanAdd', run: handleGuildBanAdd };