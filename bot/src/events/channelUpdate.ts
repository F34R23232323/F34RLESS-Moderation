import { PermissionsBitField, type GuildChannel } from 'discord.js';
import type { App } from '../core/context';

function humanizePerm(name: string): string {
  return name.replace(/([A-Z])/g, ' $1').trim();
}

function permList(bits: bigint): string {
  const names = new PermissionsBitField(bits).toArray().map(humanizePerm);
  return names.length ? names.join(', ') : 'none';
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

export async function handleChannelUpdate(app: App, oldChannel: GuildChannel, newChannel: GuildChannel): Promise<void> {
  const changes: string[] = [];

  if (oldChannel.name !== newChannel.name) changes.push(`Name: ${oldChannel.name} -> ${newChannel.name}`);
  const oldAny = oldChannel as unknown as { topic?: string };
  const newAny = newChannel as unknown as { topic?: string };
  if (oldAny.topic !== newAny.topic) changes.push('Topic changed');
  changes.push(...diffPermissionOverwrites(oldChannel, newChannel));

  if (changes.length === 0) return;
  await app.logManager.log({
    event: 'channel_update',
    guildId: newChannel.guild.id,
    channelId: newChannel.id,
    message: `Channel #${newChannel.name} updated`,
    details: { changes: changes.join('\n') },
  });
}

export default { name: 'channelUpdate', run: handleChannelUpdate };
