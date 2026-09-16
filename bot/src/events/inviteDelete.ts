import { AuditLogEvent, type Invite } from 'discord.js';
import type { App } from '../core/context';
import { resolveAuditActor } from '../utils/auditLog';

export async function handleInviteDelete(app: App, invite: Invite): Promise<void> {
  const guildId = invite.guild?.id ?? '0';
  const guild = guildId !== '0' ? app.client.guilds.cache.get(guildId) ?? null : null;
  if (guild) await app.antiNuke.observe({ guild, type: 'invite_delete', targetType: 'invite', targetId: invite.code,
    before: { channelId: invite.channel?.id ?? null } });
  const actorId = guild
    ? await resolveAuditActor(app, guild, AuditLogEvent.InviteDelete, {
        match: (e) => e.targetId === invite.code || (e.extra as { code?: string } | null)?.code === invite.code,
      })
    : null;
  await app.logManager.log({
    event: 'invite_delete',
    guildId,
    channelId: invite.channel?.id ?? null,
    actorId,
    message: `Invite deleted: discord.gg/${invite.code}`,
    details: { code: invite.code },
  });

  app.inviteTracker.updateOnDelete(invite);
}

export default { name: 'inviteDelete', run: handleInviteDelete };
