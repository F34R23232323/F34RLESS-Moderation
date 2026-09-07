import { AuditLogEvent, type ThreadChannel } from 'discord.js';
import type { App } from '../core/context';
import { resolveAuditActor } from '../utils/auditLog';

export async function handleThreadCreate(app: App, thread: ThreadChannel): Promise<void> {
  const guild = thread.guild;
  await app.antiNuke.observe({ guild, type: 'thread_create', targetType: 'thread', targetId: thread.id, after: { name: thread.name, parentId: thread.parentId } });
  const actorId = guild ? await resolveAuditActor(app, guild, AuditLogEvent.ThreadCreate, { targetId: thread.id }) : null;
  await app.logManager.log({
    event: 'thread_create',
    guildId: thread.guildId,
    channelId: thread.parentId,
    actorId,
    message: `Thread created: ${thread.name}`,
    details: { name: thread.name, id: thread.id, parentId: thread.parentId, type: thread.type },
  });
}

export default { name: 'threadCreate', run: handleThreadCreate };
