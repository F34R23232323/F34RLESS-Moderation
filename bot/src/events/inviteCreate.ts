import type { Invite } from 'discord.js';
import type { App } from '../core/context';

export async function handleInviteCreate(app: App, invite: Invite): Promise<void> {
  const guildId = invite.guild?.id ?? '0';
  await app.logManager.log({
    event: 'invite_create',
    guildId,
    channelId: invite.channel?.id ?? null,
    actorId: invite.inviter?.id ?? null,
    message: `Invite created: discord.gg/${invite.code}${invite.maxUses ? ` (${invite.maxUses} uses)` : ''}`,
    details: { code: invite.code, uses: invite.uses, maxUses: invite.maxUses },
  });

  if (app.config.invite_tracking.enabled) {
    await app.db.execute(
      `INSERT INTO invite_tracking (guild_id, invite_code, inviter_id, uses, expires_at)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE inviter_id = VALUES(inviter_id), uses = VALUES(uses)`,
      [guildId, invite.code, invite.inviter?.id ?? null, invite.uses ?? 0, invite.expiresTimestamp ? new Date(invite.expiresTimestamp) : null],
    );
  }
}

export default { name: 'inviteCreate', run: handleInviteCreate };