import { PermissionsBitField, type ForumChannel, type GuildChannel, type TextChannel, type ThreadChannel, type VoiceChannel } from 'discord.js';
import type { App } from '../core/context';

function humanizePerm(name: string): string {
  return name.replace(/([A-Z])/g, ' $1').trim();
}

function permList(bits: bigint): string {
  const names = new PermissionsBitField(bits).toArray().map(humanizePerm);
  return names.length ? names.join(', ') : 'none';
}

function humanizeSeconds(s: number | undefined | null): string {
  if (!s || s <= 0) return 'off';
  return `${s}s`;
}

function humanizeValue(v: unknown): string {
  if (v === undefined || v === null) return 'unknown';
  if (typeof v === 'boolean') return v ? 'on' : 'off';
  return String(v);
}

function diffPermissionOverwrites(oldChannel: GuildChannel, newChannel: GuildChannel): string[] {
  const oldCache = oldChannel.permissionOverwrites.cache;
  const newCache = newChannel.permissionOverwrites.cache;
  const keys = new Set([...oldCache.keys(), ...newCache.keys()]);
  const lines: string[] = [];

  for (const key of keys) {
    const oldOW = oldCache.get(key);
    const newOW = newCache.get(key);
    const oldAllow = oldOW?.allow.bitfield ?? 0n;
    const newAllow = newOW?.allow.bitfield ?? 0n;
    const oldDeny = oldOW?.deny.bitfield ?? 0n;
    const newDeny = newOW?.deny.bitfield ?? 0n;
    if (oldAllow === newAllow && oldDeny === newDeny) continue;

    const role = newChannel.guild.roles.cache.get(key);
    const member = newChannel.guild.members.cache.get(key);
    const target = role ? `@${role.name}` : member ? `@${member.user.username}` : key;

    if (!oldOW) {
      lines.push(`${target}: overwrite added (allow: ${permList(newAllow)}, deny: ${permList(newDeny)})`);
      continue;
    }
    if (!newOW) {
      lines.push(`${target}: overwrite removed`);
      continue;
    }

    const parts: string[] = [];
    const allowAdded = newAllow & ~oldAllow;
    const allowRemoved = oldAllow & ~newAllow;
    const denyAdded = newDeny & ~oldDeny;
    const denyRemoved = oldDeny & ~newDeny;
    if (allowAdded) parts.push(`allow: ${permList(allowAdded)}`);
    if (allowRemoved) parts.push(`unset allow: ${permList(allowRemoved)}`);
    if (denyAdded) parts.push(`deny: ${permList(denyAdded)}`);
    if (denyRemoved) parts.push(`unset deny: ${permList(denyRemoved)}`);
    lines.push(`${target}: ${parts.join('; ')}`);
  }

  return lines;
}

function trunc(s: string, max = 200): string {
  return s.length > max ? `${s.slice(0, max)}…` : s;
}

export async function handleChannelUpdate(app: App, oldChannel: GuildChannel, newChannel: GuildChannel): Promise<void> {
  const changes: Record<string, string> = {};

  if (oldChannel.name !== newChannel.name) changes['Name'] = `${oldChannel.name} -> ${newChannel.name}`;
  if (oldChannel.type !== newChannel.type) changes['Type'] = `${oldChannel.type} -> ${newChannel.type}`;

  const oldText = oldChannel as unknown as TextChannel;
  const newText = newChannel as unknown as TextChannel;
  if ('topic' in oldChannel && 'topic' in newChannel) {
    const oldTopic = oldText.topic ?? '';
    const newTopic = newText.topic ?? '';
    if (oldTopic !== newTopic) {
      changes['Topic'] = !oldTopic ? `set to "${trunc(newTopic)}"` : !newTopic ? `cleared (was "${trunc(oldTopic)}")` : `"${trunc(oldTopic)}" -> "${trunc(newTopic)}"`;
    }
  }
  if ('nsfw' in oldChannel && 'nsfw' in newChannel && oldText.nsfw !== newText.nsfw) {
    changes['NSFW'] = `${oldText.nsfw ? 'on' : 'off'} -> ${newText.nsfw ? 'on' : 'off'}`;
  }
  if ('rateLimitPerUser' in oldChannel && 'rateLimitPerUser' in newChannel && oldText.rateLimitPerUser !== newText.rateLimitPerUser) {
    changes['Slowmode'] = `${humanizeSeconds(oldText.rateLimitPerUser)} -> ${humanizeSeconds(newText.rateLimitPerUser)}`;
  }
  if ('defaultAutoArchiveDuration' in oldChannel && 'defaultAutoArchiveDuration' in newChannel && oldText.defaultAutoArchiveDuration !== newText.defaultAutoArchiveDuration) {
    changes['Auto-archive'] = `${humanizeValue(oldText.defaultAutoArchiveDuration)} -> ${humanizeValue(newText.defaultAutoArchiveDuration)}`;
  }
  if ('defaultThreadRateLimitPerUser' in oldChannel && 'defaultThreadRateLimitPerUser' in newChannel && oldText.defaultThreadRateLimitPerUser !== newText.defaultThreadRateLimitPerUser) {
    changes['Thread slowmode'] = `${humanizeSeconds(oldText.defaultThreadRateLimitPerUser)} -> ${humanizeSeconds(newText.defaultThreadRateLimitPerUser)}`;
  }

  const oldVoice = oldChannel as unknown as VoiceChannel;
  const newVoice = newChannel as unknown as VoiceChannel;
  if ('bitrate' in oldChannel && 'bitrate' in newChannel && oldVoice.bitrate !== newVoice.bitrate) {
    changes['Bitrate'] = `${Math.round((oldVoice.bitrate ?? 0) / 1000)} kbps -> ${Math.round((newVoice.bitrate ?? 0) / 1000)} kbps`;
  }
  if ('userLimit' in oldChannel && 'userLimit' in newChannel && oldVoice.userLimit !== newVoice.userLimit) {
    changes['User limit'] = `${humanizeValue(oldVoice.userLimit)} -> ${humanizeValue(newVoice.userLimit)}`;
  }
  if ('rtcRegion' in oldChannel && 'rtcRegion' in newChannel && oldVoice.rtcRegion !== newVoice.rtcRegion) {
    changes['Region'] = `${oldVoice.rtcRegion ?? 'auto'} -> ${newVoice.rtcRegion ?? 'auto'}`;
  }
  if ('videoQualityMode' in oldChannel && 'videoQualityMode' in newChannel && oldVoice.videoQualityMode !== newVoice.videoQualityMode) {
    changes['Video quality'] = `${humanizeValue(oldVoice.videoQualityMode)} -> ${humanizeValue(newVoice.videoQualityMode)}`;
  }

  const oldForum = oldChannel as unknown as ForumChannel;
  const newForum = newChannel as unknown as ForumChannel;
  if ('availableTags' in oldChannel && 'availableTags' in newChannel) {
    const oldTags = oldForum.availableTags?.length ?? 0;
    const newTags = newForum.availableTags?.length ?? 0;
    if (oldTags !== newTags) changes['Tags'] = `${oldTags} -> ${newTags}`;
  }
  if ('defaultReactionEmoji' in oldChannel && 'defaultReactionEmoji' in newChannel) {
    const oldEmoji = oldForum.defaultReactionEmoji ? 'set' : 'none';
    const newEmoji = newForum.defaultReactionEmoji ? 'set' : 'none';
    if (oldEmoji !== newEmoji) changes['Default emoji'] = `${oldEmoji} -> ${newEmoji}`;
  }
  if ('defaultSortOrder' in oldChannel && 'defaultSortOrder' in newChannel && oldForum.defaultSortOrder !== newForum.defaultSortOrder) {
    changes['Sort order'] = `${humanizeValue(oldForum.defaultSortOrder)} -> ${humanizeValue(newForum.defaultSortOrder)}`;
  }
  if ('defaultForumLayout' in oldChannel && 'defaultForumLayout' in newChannel && oldForum.defaultForumLayout !== newForum.defaultForumLayout) {
    changes['Forum layout'] = `${humanizeValue(oldForum.defaultForumLayout)} -> ${humanizeValue(newForum.defaultForumLayout)}`;
  }

  const oldThread = oldChannel as unknown as ThreadChannel;
  const newThread = newChannel as unknown as ThreadChannel;
  if ('archived' in oldChannel && 'archived' in newChannel) {
    if (oldThread.name !== newThread.name) changes['Thread name'] = `${oldThread.name} -> ${newThread.name}`;
    if (oldThread.archived !== newThread.archived) changes['Archived'] = `${oldThread.archived ? 'yes' : 'no'} -> ${newThread.archived ? 'yes' : 'no'}`;
    if (oldThread.locked !== newThread.locked) changes['Locked'] = `${oldThread.locked ? 'yes' : 'no'} -> ${newThread.locked ? 'yes' : 'no'}`;
    if (oldThread.autoArchiveDuration !== newThread.autoArchiveDuration) {
      changes['Auto-archive'] = `${oldThread.autoArchiveDuration ?? 'none'} -> ${newThread.autoArchiveDuration ?? 'none'}`;
    }
  }

  const oldParent = oldChannel.parent?.name;
  const newParent = newChannel.parent?.name;
  if (oldParent !== newParent) changes['Category'] = `${oldParent ?? 'none'} -> ${newParent ?? 'none'}`;

  if (oldChannel.rawPosition !== newChannel.rawPosition) {
    changes['Position'] = `${oldChannel.rawPosition} -> ${newChannel.rawPosition}`;
  }

  const permChanges = diffPermissionOverwrites(oldChannel, newChannel);
  if (permChanges.length > 0) changes['Permissions'] = permChanges.join('; ');

  if (Object.keys(changes).length === 0) return;
  await app.logManager.log({
    event: 'channel_update',
    guildId: newChannel.guild.id,
    channelId: newChannel.id,
    message: `Channel <#${newChannel.id}> updated`,
    details: { channel: `#${newChannel.name}`, changes },
  });
}

export default { name: 'channelUpdate', run: handleChannelUpdate };
