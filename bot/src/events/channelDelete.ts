import { AuditLogEvent, type GuildChannel } from 'discord.js';
import type { App } from '../core/context';
import { resolveAuditActor } from '../utils/auditLog';

export async function handleChannelDelete(app: App, channel: GuildChannel): Promise<void> {
  const actorId = await resolveAuditActor(app, channel.guild, AuditLogEvent.ChannelDelete, { targetId: channel.id });
  await app.logManager.log({
    event: 'channel_delete',
    guildId: channel.guild.id,
    channelId: channel.id,
    actorId,
    message: `Channel #${channel.name} deleted`,
    details: { type: channel.type, id: channel.id },
  });
}

export default { name: 'channelDelete', run: handleChannelDelete };