import { AuditLogEvent, ChannelType, type GuildChannel } from 'discord.js';
import type { App } from '../core/context';
import { resolveAuditActor } from '../utils/auditLog';

function channelTypeTitle(type: ChannelType): string {
  switch (type) {
    case ChannelType.GuildText: return 'Text channel deleted';
    case ChannelType.GuildVoice: return 'Voice channel deleted';
    case ChannelType.GuildCategory: return 'Category deleted';
    case ChannelType.GuildAnnouncement: return 'Announcement channel deleted';
    case ChannelType.GuildForum: return 'Forum channel deleted';
    case ChannelType.GuildStageVoice: return 'Stage channel deleted';
    default: return 'Channel deleted';
  }
}

export async function handleChannelDelete(app: App, channel: GuildChannel): Promise<void> {
  await app.antiNuke.observe({ guild: channel.guild, type: 'channel_delete', targetType: 'channel', targetId: channel.id,
    before: { name: channel.name, type: channel.type } });
  const actorId = await resolveAuditActor(app, channel.guild, AuditLogEvent.ChannelDelete, { targetId: channel.id });
  const parent = channel.parent ?? (channel.parentId ? channel.guild.channels.cache.get(channel.parentId) : null);
  await app.logManager.log({
    event: 'channel_delete',
    guildId: channel.guild.id,
    channelId: channel.id,
    actorId,
    message: `Channel #${channel.name} deleted`,
    details: {
      channelTypeTitle: channelTypeTitle(channel.type),
      name: channel.name,
      id: channel.id,
      category: parent ? parent.name : undefined,
    },
  });
}

export default { name: 'channelDelete', run: handleChannelDelete };

