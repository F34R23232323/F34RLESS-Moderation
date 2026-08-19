import type { Message, PartialMessage } from 'discord.js';
import type { App } from '../core/context';
import { captureDeleted } from '../utils/snipe';

export async function handleMessageDelete(app: App, message: Message | PartialMessage): Promise<void> {
  try {
    captureDeleted(message);
    app.messageCache.delete(message.id);
    if (message.guildId) {
      await app.messageLogs.onMessageDelete(message);
    }
    const content = message.content || '';
    await app.logManager.log({
      event: 'message_delete',
      guildId: message.guildId ?? '0',
      channelId: message.channelId,
      actorId: null,
      targetId: message.author?.id ?? null,
      message: `Message deleted in <#${message.channelId}> by <@${message.author?.id ?? 'unknown'}>`,
      details: {
        channelId: message.channelId,
        messageId: message.id,
        authorId: message.author?.id,
        createdAt: message.createdAt ? `<t:${Math.floor(message.createdAt.getTime() / 1000)}:f>` : undefined,
        content: content.slice(0, 1500),
        attachments: message.attachments?.size ?? 0,
      },
    });
  } catch (err) {
    app.logger.error('messageDelete handler threw:', err);
  }
}

export default { name: 'messageDelete', run: handleMessageDelete };