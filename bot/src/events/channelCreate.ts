import { AuditLogEvent, ChannelType, type GuildChannel } from 'discord.js';
import type { App } from '../core/context';
import { resolveAuditActor } from '../utils/auditLog';

function channelTypeTitle(type: ChannelType): string {
  switch (type) {
    case ChannelType.GuildText: return 'Text channel created';
    case ChannelType.GuildVoice: return 'Voice channel created';
    case ChannelType.GuildCategory: return 'Category created';
    case ChannelType.GuildAnnouncement: return 'Announcement channel created';
    case ChannelType.GuildForum: return 'Forum channel created';
    case ChannelType.GuildStageVoice: return 'Stage channel created';
    default: return 'Channel created';
  }
}

export async function handleChannelCreate(app: App, channel: GuildChannel): Promise<void> {
  await app.antiNuke.observe({ guild: channel.guild, type: 'channel_create', targetType: 'channel', targetId: channel.id,
    after: { name: channel.name, type: channel.type } });
  const actorId = await resolveAuditActor(app, channel.guild, AuditLogEvent.ChannelCreate, { targetId: channel.id });
  const parent = channel.parent ?? (channel.parentId ? channel.guild.channels.cache.get(channel.parentId) : null);
  await app.logManager.log({
    event: 'channel_create',
    guildId: channel.guild.id,
    channelId: channel.id,
    actorId,
    message: `Channel #${channel.name} created`,
    details: {
      channelTypeTitle: channelTypeTitle(channel.type),
      name: `${channel.name} ( <#${channel.id}> )`,
      id: channel.id,
      category: parent ? parent.name : undefined,
      position: 'rawPosition' in channel ? channel.rawPosition : undefined,
    },
  });
}

export default { name: 'channelCreate', run: handleChannelCreate };

