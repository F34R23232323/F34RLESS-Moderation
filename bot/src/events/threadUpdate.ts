import { AuditLogEvent, type ThreadChannel } from 'discord.js';
import type { App } from '../core/context';
import { resolveAuditActor } from '../utils/auditLog';

export async function handleThreadUpdate(app: App, oldThread: ThreadChannel, newThread: ThreadChannel): Promise<void> {
  const changes: string[] = [];
  if (oldThread.name !== newThread.name) changes.push(`Name: ${oldThread.name} -> ${newThread.name}`);
  if (oldThread.archived !== newThread.archived) changes.push(newThread.archived ? 'Archived' : 'Unarchived');
  if (oldThread.locked !== newThread.locked) changes.push(newThread.locked ? 'Locked' : 'Unlocked');
  if (oldThread.rateLimitPerUser !== newThread.rateLimitPerUser) changes.push(`Slowmode: ${oldThread.rateLimitPerUser} -> ${newThread.rateLimitPerUser}`);
  if (changes.length === 0) return;
  const guild = newThread.guild;
  await app.antiNuke.observe({ guild, type: 'thread_update', targetType: 'thread', targetId: newThread.id,
    before: { name: oldThread.name, archived: oldThread.archived, locked: oldThread.locked },
    after: { name: newThread.name, archived: newThread.archived, locked: newThread.locked } });
  const actorId = guild ? await resolveAuditActor(app, guild, AuditLogEvent.ThreadUpdate, { targetId: newThread.id }) : null;
  await app.logManager.log({
    event: 'thread_update',
    guildId: newThread.guildId,
    channelId: newThread.parentId,
    actorId,
    message: `Thread updated: ${newThread.name}`,
    details: { name: newThread.name, id: newThread.id, changes },
  });
}

export default { name: 'threadUpdate', run: handleThreadUpdate };
