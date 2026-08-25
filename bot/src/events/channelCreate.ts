import { AuditLogEvent, type GuildChannel } from 'discord.js';
import type { App } from '../core/context';
import { resolveAuditActor } from '../utils/auditLog';

export async function handleChannelCreate(app: App, channel: GuildChannel): Promise<void> {
  const actorId = await resolveAuditActor(app, channel.guild, AuditLogEvent.ChannelCreate, { targetId: channel.id });
  await app.logManager.log({
    event: 'channel_create',
    guildId: channel.guild.id,
    channelId: channel.id,
    actorId,
    message: `Channel #${channel.name} created`,
    details: { type: channel.type, id: channel.id },
  });
}

export default { name: 'channelCreate', run: handleChannelCreate };