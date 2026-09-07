import { AuditLogEvent, type ThreadChannel } from 'discord.js';
import type { App } from '../core/context';
import { resolveAuditActor } from '../utils/auditLog';

export async function handleThreadDelete(app: App, thread: ThreadChannel): Promise<void> {
  const guild = thread.guild;
  await app.antiNuke.observe({ guild, type: 'thread_delete', targetType: 'thread', targetId: thread.id, before: { name: thread.name, parentId: thread.parentId } });
  const actorId = guild ? await resolveAuditActor(app, guild, AuditLogEvent.ThreadDelete, { targetId: thread.id }) : null;
  await app.logManager.log({
    event: 'thread_delete',
    guildId: thread.guildId,
    channelId: thread.parentId,
    actorId,
    message: `Thread deleted: ${thread.name}`,
    details: { name: thread.name, id: thread.id },
  });
}

export default { name: 'threadDelete', run: handleThreadDelete };
