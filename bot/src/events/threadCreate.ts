import type { ThreadChannel } from 'discord.js';
import type { App } from '../core/context';

export async function handleThreadCreate(app: App, thread: ThreadChannel): Promise<void> {
  await app.logManager.log({
    event: 'thread_create',
    guildId: thread.guildId,
    channelId: thread.parentId,
    message: `Thread created: ${thread.name}`,
    details: { name: thread.name, id: thread.id, parentId: thread.parentId, type: thread.type },
  });
}

export default { name: 'threadCreate', run: handleThreadCreate };