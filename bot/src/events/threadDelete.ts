import type { ThreadChannel } from 'discord.js';
import type { App } from '../core/context';

export async function handleThreadDelete(app: App, thread: ThreadChannel): Promise<void> {
  await app.logManager.log({
    event: 'thread_delete',
    guildId: thread.guildId,
    channelId: thread.parentId,
    message: `Thread deleted: ${thread.name}`,
    details: { name: thread.name, id: thread.id },
  });
}

export default { name: 'threadDelete', run: handleThreadDelete };