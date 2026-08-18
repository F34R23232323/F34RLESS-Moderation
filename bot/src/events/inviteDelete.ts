import type { Invite } from 'discord.js';
import type { App } from '../core/context';

export async function handleInviteDelete(app: App, invite: Invite): Promise<void> {
  const guildId = invite.guild?.id ?? '0';
  await app.logManager.log({
    event: 'invite_delete',
    guildId,
    channelId: invite.channel?.id ?? null,
    message: `Invite deleted: discord.gg/${invite.code}`,
    details: { code: invite.code },
  });
}

export default { name: 'inviteDelete', run: handleInviteDelete };